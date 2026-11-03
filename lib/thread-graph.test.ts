import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  type GraphData,
  type GraphNode,
  ThreadGraph,
} from "../tools/thread-graph/graph.ts";

// Compares the thread and mission graph of main.txt against lib/fixtures/thread-graph.json, the
// behavior baseline that the mutex plan's rewrites are checked against. The graph comes from the
// tree-sitter-gta3 grammar (SBL_WASM in .env), so run it with the environment loaded:
//   deno test -R -E --env-file=.env lib/thread-graph.test.ts
// Line numbers are in the fixture for review but not compared, so an edit that only shifts lines
// passes. After a deliberate change, review the diff, then rewrite the fixture:
//   UPDATE_FIXTURE=1 deno test -R -E -W=lib/fixtures --env-file=.env lib/thread-graph.test.ts

const root = join(import.meta.dirname!, "..");
const fixturePath = join(import.meta.dirname!, "fixtures", "thread-graph.json");
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

// The seven mission triggers, recorded in full so Task 3 can compare their guards and effects.
const triggers = ["Star", "Police", "HOT", "Boss", "Golf", "Kill", "End"];

const graph = JSON.parse(JSON.stringify(
  await new ThreadGraph(join(root, "main.txt"), wasm, {
    trackedVars: ["$ONMISSION", "$MissionLocked", "$MissionLockGranted"],
    outline: triggers,
    cleoDirs: ["lib/threads"],
  }).build(),
)) as GraphData;

// `lib/debug.txt` is written by `deno task build`, so it may or may not exist.
const { missingIncludes, ...comparable } = graph;

function withoutLines(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutLines);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "line").map((
        [key, v],
      ) => [key, withoutLines(v)]),
    );
  }
  return value;
}

function node(id: string): GraphNode {
  const found = graph.nodes.find((n) => n.id === id);
  assert(found, `no node ${id}`);
  return found;
}

Deno.test("sources parse without error nodes", () => {
  assertEquals(graph.parseErrors, []);
  assertEquals(
    missingIncludes.filter((m) => m.file !== "main.txt" || m.line !== 24),
    [],
  );
});

Deno.test("every label reference resolves", () => {
  assertEquals(graph.unresolved, []);
});

Deno.test("nodes are listed breadth first from MAIN", () => {
  assertEquals(graph.nodes[0].id, "MAIN");
  assertEquals(graph.nodes[0].level, 0);
  const levels = graph.nodes.map((n) => n.level);
  assertEquals(levels, [...levels].sort((a, b) => a - b));
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const n of graph.nodes.slice(1)) {
    assert(n.parents.length > 0, `${n.id} has no parent`);
    for (const p of n.parents) {
      assert(ids.has(p), `${n.id} has unknown parent ${p}`);
    }
  }
});

Deno.test("MAIN streams bath.cs, launches mission 0, and starts four threads", () => {
  const edges = node("MAIN").edges.map((e) => `${e.kind}:${e.target ?? ""}`);
  assertEquals(edges, [
    "stream_custom_script:bath.cs",
    "launch_mission:0",
    "start_new_script:Star",
    "start_new_script:Save",
    "start_new_script:VPHotel",
    "start_new_script:PackageToggle",
    "terminate_this_script:",
  ]);
  assertEquals(node("cleo:bath.cs").parents, ["MAIN"]);
});

Deno.test("INIT starts 20 threads and relaunches mission 0 after death or arrest", () => {
  const init = node("INIT");
  assertEquals(init.kind, "mission");
  assertEquals(init.mission, 0);
  assertEquals(
    init.edges.filter((e) => e.kind === "start_new_script").length,
    20,
  );
  assertEquals(
    init.edges.filter((e) => e.kind === "launch_mission").map((e) => e.target),
    ["0"],
  );
  assertEquals(init.parents, ["MAIN", "INIT"]);
});

Deno.test("Fae launches mission 8", () => {
  const launch = node("Fae").edges.find((e) => e.kind === "launch_mission");
  assertEquals(launch?.target, "8");
  assertEquals(launch?.at.file, "lib/threads/fae.txt");
  assertEquals(node("Fairy").parents, ["Fae"]);
});

Deno.test("Work kills Golf by name, then starts it", () => {
  const edges = node("Work").edges.filter((e) => e.target === "Golf").map((e) =>
    e.kind
  );
  assertEquals(edges, ["terminate_by_name", "start_new_script"]);
});

Deno.test("threads that restart themselves are marked", () => {
  for (const id of ["Barrier", "HOT", "Mystery", "ringu", "VehHeal"]) {
    assert(
      node(id).edges.some((e) => e.kind === "start_new_script" && e.self),
      `${id} does not restart itself`,
    );
  }
});

Deno.test("the seven triggers launch the next mission or thread in chain order", () => {
  const launched = Object.fromEntries(
    triggers.map((
      id,
    ) => [id, node(id).edges.find((e) => e.kind === "launch_mission")?.target]),
  );
  assertEquals(launched, {
    Star: "1",
    Police: "2",
    HOT: "3",
    Boss: "4",
    Golf: "5",
    Kill: "6",
    End: "7",
  });
  for (const id of triggers) {
    assert(node(id).outline?.length, `${id} has no outline`);
  }
});

Deno.test("mission 10 points at a label that does not exist, and Tools and Hell are never started", () => {
  assertEquals(graph.missions.filter((m) => !m.resolved).map((m) => m.number), [
    10,
  ]);
  const unreached = graph.scriptNames.filter((s) => s.status === "unreached")
    .map((s) => s.name);
  assertEquals(unreached, ["Tools", "Hell"]);
});

Deno.test("every use of the mission flag outside main.txt is recorded", () => {
  const outside = graph.flagUses.filter((u) =>
    u.var === "$ONMISSION" && u.file !== "main.txt"
  );
  const perFile = Object.groupBy(outside, (u) => u.file);
  assertEquals(
    Object.fromEntries(
      Object.entries(perFile).map(([file, uses]) => [file, uses!.length]),
    ),
    {
      "lib/threads/ringu.txt": 5,
      "lib/threads/bus.txt": 7,
      "lib/threads/bath.txt": 5,
      "lib/threads/mystery.txt": 3,
      "lib/threads/fae.txt": 1,
      "lib/threads/savehot.txt": 1,
      "missions/intro.txt": 6,
      "missions/cop.txt": 5,
      "missions/hotel.txt": 3,
      "missions/work.txt": 3,
      "missions/cart.txt": 4,
      "missions/bossdie.txt": 3,
      "missions/endgame.txt": 2,
      "missions/fairy.txt": 3,
    },
  );
});

Deno.test("the graph matches the fixture", async () => {
  if (Deno.env.get("UPDATE_FIXTURE")) {
    await Deno.writeTextFile(
      fixturePath,
      JSON.stringify(comparable, null, 2) + "\n",
    );
  }
  const fixture = JSON.parse(await Deno.readTextFile(fixturePath));
  assertEquals(
    withoutLines(JSON.parse(JSON.stringify(comparable))),
    withoutLines(fixture),
  );
});
