/**
 * @module
 * Tests for the effect-trace enumeration of `FlowProgram`.
 * `deno test tools/flow-model/program.test.ts`
 */
import { assertEquals } from "@std/assert";
import { FlowProgram } from "./program.ts";

const eff = (text: string) => ({ op: "eff", text }) as const;

Deno.test("a run that ends inside the bound is not cut", () => {
  const program = FlowProgram.of([eff("a"), eff("b"), { op: "stop" }], "T");
  assertEquals(program.cutRuns(true, 3), [{ effects: ["a", "b"], cut: false }]);
});

Deno.test("a run that hits the bound before the script ends is cut", () => {
  const program = FlowProgram.of([eff("a"), eff("b"), { op: "stop" }], "T");
  assertEquals(program.cutRuns(true, 1), [{ effects: ["a"], cut: true }]);
});

Deno.test("a loop with no end gives only cut runs", () => {
  const program = FlowProgram.of([eff("a"), { op: "jmp", to: 0 }], "T");
  assertEquals(program.cutRuns(true, 3), [
    { effects: ["a", "a", "a"], cut: true },
  ]);
});

Deno.test("a run whose last effect is the last step is not cut", () => {
  const program = FlowProgram.of([eff("a"), { op: "jmp", to: 2 }, {
    op: "stop",
  }], "T");
  assertEquals(program.cutRuns(true, 1), [{ effects: ["a"], cut: false }]);
});

Deno.test("runs gives the same effect lists as before", () => {
  const program = FlowProgram.of([eff("a"), eff("b"), { op: "stop" }], "T");
  assertEquals(program.runs(true, 1), [["a"]]);
  assertEquals(program.runs(true, 3), [["a", "b"]]);
});
