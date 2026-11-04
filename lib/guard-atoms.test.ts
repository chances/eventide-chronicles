import { assertEquals } from "@std/assert";
import type { GraphNode } from "../tools/thread-graph/graph.ts";
import { FlowProgram, type Ins } from "../tools/flow-model/program.ts";
import { baselineLock } from "../tools/flow-model/config.ts";

// Checks the exit atoms of the flow model: death, arrest, and countdown guards compile to atoms, each
// atom is sticky within a run, and the shortest distance to each ending is the bound a body needs.
//   deno test -R lib/guard-atoms.test.ts

const program = (ins: Ins[]) => FlowProgram.of(ins, "T");

function node(conditions: string[], mode: "single" | "and" | "or"): GraphNode {
  return {
    id: "T",
    outline: [{
      label: "T",
      at: { file: "t.txt", line: 1 },
      statements: [{
        kind: "if",
        line: 2,
        mode,
        conditions,
        then: [{
          kind: "function_call",
          line: 3,
          text: "Text.Print('A', 1, 1)",
        }],
      }],
    }],
  } as unknown as GraphNode;
}

const atomsOf = (conditions: string[], mode: "single" | "and" | "or" = "and") =>
  FlowProgram.compile(node(conditions, mode), baselineLock).ins.flatMap((i) =>
    i.op === "br" ? [i.atoms] : []
  )[0];

Deno.test("has_deatharrest_been_executed compiles to wasted, and its negation to notWasted", () => {
  assertEquals(atomsOf(["has_deatharrest_been_executed"]), ["wasted"]);
  assertEquals(atomsOf(["not has_deatharrest_been_executed"]), ["notWasted"]);
});

Deno.test("$TIMER == 0 compiles to timerOut, and its negations to timerRunning", () => {
  assertEquals(atomsOf(["$TIMER == 0"]), ["timerOut"]);
  assertEquals(atomsOf(["not $TIMER == 0"]), ["timerRunning"]);
  assertEquals(atomsOf(["$TIMER != 0"]), ["timerRunning"]);
});

Deno.test("a wasted test that went true stays true: no alive branch follows a dead one", () => {
  const p = program([
    { op: "br", mode: "and", atoms: ["wasted"], t: 1, f: 3 }, // 0
    { op: "eff", text: "dead1" }, // 1
    { op: "jmp", to: 4 }, // 2
    { op: "eff", text: "alive1" }, // 3
    { op: "br", mode: "and", atoms: ["notWasted"], t: 5, f: 6 }, // 4
    { op: "eff", text: "alive2" }, // 5
    { op: "stop" }, // 6
  ]);
  assertEquals(p.runs(true, 5), [
    ["alive1", "alive2"],
    ["alive1"],
    ["dead1"],
  ]);
});

Deno.test("a countdown that ran out stays out: a loop on timerRunning ends and never restarts", () => {
  const p = program([
    { op: "br", mode: "and", atoms: ["timerRunning"], t: 1, f: 3 }, // 0
    { op: "eff", text: "tick" }, // 1
    { op: "jmp", to: 0 }, // 2
    { op: "eff", text: "done" }, // 3
    { op: "stop" }, // 4
  ]);
  assertEquals(p.runs(true, 3), [
    ["done"],
    ["tick", "done"],
    ["tick", "tick", "done"],
    ["tick", "tick", "tick"],
  ]);
});

Deno.test("died and arrested are separate flags, and wasted is true when either holds", () => {
  const p = program([
    { op: "br", mode: "and", atoms: ["died"], t: 1, f: 2 }, // 0
    { op: "eff", text: "died" }, // 1
    { op: "br", mode: "and", atoms: ["arrested", "wasted"], t: 3, f: 4 }, // 2
    { op: "eff", text: "both" }, // 3
    { op: "stop" }, // 4
  ]);
  assertEquals(p.runs(true, 3), [
    ["both"],
    ["died", "both"],
    ["died"],
    [],
  ]);
});

Deno.test("endingDepths gives the fewest effects to each ending", () => {
  const p = program([
    { op: "br", mode: "and", atoms: ["free"], t: 1, f: 3 }, // 0
    { op: "eff", text: "a" }, // 1
    { op: "eff", text: "b" }, // 2
    { op: "stop" }, // 3 reached with 0 effects or after a, b
    { op: "eff", text: "c" }, // 4
    { op: "stop" }, // 5 never reached
  ]);
  assertEquals(p.endingDepths(true), [{ pc: 3, depth: 0 }]);
});

Deno.test("endingDepths counts a loop's effect once and reaches the exit", () => {
  const p = program([
    { op: "br", mode: "and", atoms: ["timerRunning"], t: 1, f: 3 }, // 0
    { op: "eff", text: "tick" }, // 1
    { op: "jmp", to: 0 }, // 2
    { op: "eff", text: "done" }, // 3
    { op: "stop" }, // 4
  ]);
  assertEquals(p.endingDepths(true), [{ pc: 4, depth: 1 }]);
});
