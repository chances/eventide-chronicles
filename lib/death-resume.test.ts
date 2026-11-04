import { assertEquals } from "@std/assert";
import type { Ins } from "../tools/flow-model/program.ts";
import { StateGraph, ThreadProgram } from "../tools/flow-model/state-graph.ts";
import { ShortestPaths } from "../tools/flow-model/shortest-paths.ts";

// Checks the engine's death resume in the state graph: with `resumeOnDeath`, every state inside the first
// call has a no-effect edge to the instruction after that call with the died flag set.
//   deno test -R lib/death-resume.test.ts

// A mission-shaped thread: call the body, then test the death check after the call returns.
const MISSION: Ins[] = [
  { op: "call", to: 4 }, // 0
  { op: "br", mode: "and", atoms: ["wasted"], t: 2, f: 3 }, // 1
  { op: "eff", text: "handler" }, // 2
  { op: "stop" }, // 3
  { op: "eff", text: "body-a" }, // 4
  { op: "eff", text: "body-b" }, // 5
  { op: "ret" }, // 6
];

const endings = (resumeOnDeath: boolean) =>
  new ShortestPaths(
    StateGraph.build(ThreadProgram.of(MISSION, "T"), {
      lockFree: true,
      resumeOnDeath,
    }),
  ).endings();

Deno.test("without resumeOnDeath the death check is reached only after the whole body", () => {
  const [ending] = endings(false);
  assertEquals(ending.pc, 3);
  assertEquals(ending.depth, 2);
  assertEquals(
    ending.steps.flatMap((s) => s.kind === "effect" ? [s.text] : []),
    ["body-a", "body-b"],
  );
});

Deno.test("with resumeOnDeath the death check is reached with no body effect", () => {
  const [ending] = endings(true);
  assertEquals(ending.pc, 3);
  assertEquals(ending.depth, 1);
  assertEquals(
    ending.steps.flatMap((s) => s.kind === "effect" ? [s.text] : []),
    ["handler"],
  );
});

Deno.test("the resume edge sets the died flag, so the death check can only be true", () => {
  const graph = StateGraph.build(ThreadProgram.of(MISSION, "T"), {
    lockFree: true,
    resumeOnDeath: true,
  });
  const resumed = [...Array(graph.size).keys()].filter((id) => {
    const s = graph.state(id);
    return s.pc === 1 && s.stack.length === 0 && s.flags !== 0;
  });
  assertEquals(resumed.length > 0, true);
  for (const id of resumed) {
    const outcomes = graph.edges(id).flatMap((e) =>
      e.kind === "guard" ? [e.outcome] : []
    );
    assertEquals(outcomes, [true]);
  }
});

Deno.test("a thread with no call has no resume edge", () => {
  const flat: Ins[] = [{ op: "eff", text: "only" }, { op: "stop" }];
  const graph = StateGraph.build(ThreadProgram.of(flat, "T"), {
    lockFree: true,
    resumeOnDeath: true,
  });
  assertEquals(graph.size, 2);
});
