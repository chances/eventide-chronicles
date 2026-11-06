import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  type GraphData,
  type GraphNode,
  ThreadGraph,
} from "../tools/thread-graph/graph.ts";
import { FlowProgram } from "../tools/flow-model/program.ts";
import {
  baselineLock,
  bound,
  candidateLock,
  isCommit,
  triggers,
} from "../tools/flow-model/config.ts";

// Checks that each of the seven mission triggers has the baseline's effect traces with the mission lock
// free, and launches nothing with it held. The baseline is lib/fixtures/thread-graph.baseline.json. The
// candidate is the trigger as it stands in main.txt. Each trigger is compiled to a
// small instruction list; every guard that does not read the lock is a free input that may go either way.
//   - Lock free: the candidate has the same effect traces as the baseline.
//   - Lock held: the candidate has no effect that launches a mission or prepares for one (`commitPrefixes`).
// Run it with the environment loaded (SBL_WASM in .env):
//   deno test -R -E --env-file=.env lib/mission-flow.test.ts

const root = join(import.meta.dirname!, "..");
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const launches: Record<string, number> = {
  Star: 1,
  Police: 2,
  HOT: 3,
  Boss: 4,
  Golf: 5,
  Kill: 6,
  End: 7,
};
const baseline = JSON.parse(
  await Deno.readTextFile(
    join(root, "lib", "fixtures", "thread-graph.baseline.json"),
  ),
) as GraphData;
const live = await new ThreadGraph(join(root, "main.txt"), wasm, {
  trackedVars: [],
  outline: triggers,
  cleoDirs: ["lib/threads"],
}).build();

function node(graph: GraphData, id: string): GraphNode {
  const found = graph.nodes.find((n) => n.id === id);
  assert(found, `no node ${id}`);
  return found;
}

const launched = (run: string[]) =>
  run.some((e) => e.includes("Mission.LoadAndLaunchInternal"));

// Self-check of the oracle, independent of main.txt: renaming the flag in a baseline copy is a correct
// gate for every trigger that already tests it, and `End` still fails because it never tests the lock.
for (const id of triggers) {
  const renamed = JSON.parse(
    JSON.stringify(node(baseline, id)).replaceAll(
      "$ONMISSION",
      "$MissionLocked",
    ),
  ) as GraphNode;
  const before = FlowProgram.compile(node(baseline, id), baselineLock);
  const after = FlowProgram.compile(renamed, candidateLock);
  Deno.test(`self-check ${id}: a renamed gate has the baseline traces with the lock free`, () => {
    assertEquals(after.runs(true, bound), before.runs(true, bound));
  });
  Deno.test(`self-check ${id}: a renamed gate ${id === "End" ? "does not stop" : "stops"} a launch with the lock held`, () => {
    const held = after.runs(false, bound);
    assertEquals(held.some(launched), id === "End");
    assertEquals(held.every((run) => !run.some(isCommit)), id !== "End");
  });
}

for (const id of triggers) {
  const before = FlowProgram.compile(node(baseline, id), baselineLock);
  const after = FlowProgram.compile(node(live, id), candidateLock);

  Deno.test(`${id}: the baseline reaches mission ${launches[id]} when the lock is free`, () => {
    const runs = before.runs(true, bound);
    assert(
      runs.some((r) =>
        r.some((e) => e === `Mission.LoadAndLaunchInternal(${launches[id]})`)
      ),
      `${id} baseline never launches mission ${
        launches[id]
      } within ${bound} effects`,
    );
  });

  Deno.test(`${id}: lock free, the same effect traces as the baseline`, () => {
    assertEquals(after.runs(true, bound), before.runs(true, bound));
  });

  Deno.test(`${id}: lock held, launches nothing and prepares nothing`, () => {
    const runs = after.runs(false, bound);
    assert(!runs.some(launched), `${id} launches while the lock is held`);
    for (const run of runs) {
      assert(
        !run.some(isCommit),
        `${id} starts a launch while the lock is held: ${run.join(" | ")}`,
      );
    }
  });
}
