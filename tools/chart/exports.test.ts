import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { ControlFlow } from "@eventide/cfg";
import { SourceProgram, ThreadGraph } from "@eventide/thread-graph";
import { FlowProgram, StateGraph } from "@eventide/flow-model";

const root = join(import.meta.dirname!, "..", "..");

Deno.test("each static tool exposes its library entry point by package name", () => {
  assertExists(ControlFlow);
  assertExists(ThreadGraph);
  assertExists(SourceProgram);
  assertExists(FlowProgram);
  assertExists(StateGraph);
});

Deno.test("ControlFlow returns the blocks the command prints", async () => {
  const flow = await ControlFlow.load(join(root, "main.txt"));
  const blocks = flow.reachable("Star").map((b) => JSON.stringify(b));
  assertEquals(blocks.length > 0, true);
  assertEquals(JSON.parse(blocks[0]).label, "Star");
});
