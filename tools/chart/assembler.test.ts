import { assert, assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";

/**
 * @module
 * Tests for the chart assembler. Needs the tree-sitter-gta3 wasm named by `SBL_WASM` in `.env`:
 * `deno test -R -E --env-file=.env tools/chart/assembler.test.ts`
 */
const root = join(import.meta.dirname!, "..", "..");
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const fixture = new ChartAssembler(
  join(import.meta.dirname!, "fixtures", "globals", "main.txt"),
  wasm,
);

Deno.test("globals lists each global the mission touches with its accessor and access kind", async () => {
  assertEquals(await fixture.globals("alpha"), [
    { name: "$ONMISSION", accessor: "Alpha", kind: "write" },
    { name: "$flag", accessor: "Alpha", kind: "read" },
    { name: "$flag", accessor: "Watcher", kind: "write" },
    { name: "$private", accessor: "Alpha", kind: "write" },
    { name: "$score", accessor: "Alpha", kind: "write" },
    { name: "$score", accessor: "Watcher", kind: "read" },
  ]);
});

Deno.test("globals reached through an include file are listed", async () => {
  const names = (await fixture.globals("alpha")).map((g) => g.name);
  assert(names.includes("$private"), "the global used only in mission.txt");
});

Deno.test("a thread that touches no global of the mission is absent", async () => {
  const accessors = (await fixture.globals("alpha")).map((g) => g.accessor);
  assert(!accessors.includes("Idle"));
  assert(!(await fixture.globals("alpha")).some((g) => g.name === "$other"));
});

const launchSites = new ChartAssembler(
  join(import.meta.dirname!, "fixtures", "triggers", "main.txt"),
  wasm,
);

Deno.test("a launch site has its file, line, enclosing thread, and guard lines", async () => {
  assertEquals(await launchSites.launchSites("alpha"), [
    { file: "main.txt", line: 23, thread: "Trigger", guardLines: [15, 18, 21] },
  ]);
});

Deno.test("a launch outside any nesting has only the earlier if-goto guard", async () => {
  assertEquals(await launchSites.launchSites("beta"), [
    { file: "main.txt", line: 26, thread: "Trigger", guardLines: [15] },
  ]);
});

Deno.test("a launch of mission 0 is absent from the launch sites of other missions", async () => {
  const lines = [
    ...await launchSites.launchSites("alpha"),
    ...await launchSites.launchSites("beta"),
  ].map((s) => s.line);
  assert(!lines.includes(27));
});

Deno.test("each of missions 1 to 6 is launched by its trigger, and mission 7 is not among them", async () => {
  const real = new ChartAssembler(join(root, "main.txt"), wasm, {
    cleoDirs: ["lib/threads"],
  });
  const triggers = {
    intro: "Star",
    cop: "Police",
    hotel: "HOT",
    work: "Boss",
    cart: "Golf",
    bossdie: "Kill",
  };
  for (const [mission, thread] of Object.entries(triggers)) {
    const sites = await real.launchSites(mission);
    assertEquals(sites.map((s) => s.thread), [thread], mission);
    for (const site of sites) {
      assertEquals(site.file, "main.txt");
      assert(site.line > 0 && site.guardLines.length > 0, mission);
      assert(site.guardLines.every((l) => l < site.line), mission);
    }
  }
});

Deno.test("traces cover the trigger with the lock free and held, and the mission script with the lock held", async () => {
  const traces = await launchSites.traces("alpha");
  const kinds = [...new Set(traces.map((t) => `${t.script} ${t.lock} ${t.bound}`))];
  assertEquals(kinds.sort(), ["Alpha held 24", "Trigger free 12", "Trigger held 12"]);
  for (const t of traces) {
    assert(t.effects.length <= t.bound, `${t.script} exceeds its bound`);
    if (t.script === "Trigger") assert(t.cut, "a trigger loop is always cut");
  }
});

Deno.test("the bounds can be set", async () => {
  const small = new ChartAssembler(
    join(import.meta.dirname!, "fixtures", "triggers", "main.txt"),
    wasm,
    { triggerBound: 3, missionBound: 5 },
  );
  const kinds = new Set((await small.traces("alpha")).map((t) => t.bound));
  assertEquals([...kinds].sort(), [3, 5]);
});

Deno.test("an unknown mission is rejected with its name", async () => {
  await assertRejects(() => fixture.globals("nope"), Error, "nope");
});

Deno.test("each of missions 1 to 6 lists $ONMISSION written by the mission", async () => {
  const real = new ChartAssembler(join(root, "main.txt"), wasm, {
    cleoDirs: ["lib/threads"],
  });
  const ids = {
    intro: "Intro",
    cop: "Cop",
    hotel: "Hotel",
    work: "Work",
    cart: "Cart",
    bossdie: "BossDie",
  };
  for (const [mission, id] of Object.entries(ids)) {
    const globals = await real.globals(mission);
    assert(globals.length > 0, `${mission} lists no globals`);
    assert(
      globals.some((g) =>
        g.name === "$ONMISSION" && g.accessor === id && g.kind === "write"
      ),
      `${mission} does not list $ONMISSION written by ${id}`,
    );
    assert(
      globals.some((g) => g.accessor !== id),
      `${mission} lists no thread accessor`,
    );
  }
});
