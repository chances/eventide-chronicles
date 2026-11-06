// Control-flow graph of a Sanny Builder script, from any label.
// Usage: deno task start <script.txt> <label> [--statements]
// Prints the blocks reachable from <label> as one JSON line each. With --statements it prints the
// statements reachable from <label> instead, one JSON line each with its position and its outgoing
// edges (target statement index, guard condition chain, and whether the edge is a gosub call).
// --statements parses the script with the tree-sitter-gta3 wasm named by SBL_WASM in .env.
import { parseArgs } from "@std/cli/parse-args";
import { outlineOf, SourceProgram } from "@eventide/thread-graph";
import { ControlFlow } from "./cfg.ts";
import { FlowGraph } from "./statements.ts";

const args = parseArgs(Deno.args, { boolean: ["statements"] });
const [scriptPath, startLabel] = args._ as string[];
if (!scriptPath || !startLabel) {
  console.error("usage: deno task start <script.txt> <label> [--statements]");
  Deno.exit(1);
}
if (args.statements) {
  const wasm = Deno.env.get("SBL_WASM");
  if (!wasm) {
    console.error(
      "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env",
    );
    Deno.exit(1);
  }
  const program = await SourceProgram.load(scriptPath, wasm);
  const entry = program.resolve(startLabel);
  if (!entry) {
    console.error(`label not found: ${startLabel}`);
    Deno.exit(1);
  }
  const graph = FlowGraph.build(
    program.reach(entry).map((label) => {
      const block = program.blocks.get(label)!;
      return {
        label,
        next: block.next,
        stmts: block.stmts.map((s) => ({
          outline: outlineOf(s.node),
          file: s.file,
        })),
      };
    }),
    (name) => program.resolve(name),
  );
  graph.items.forEach((item, index) =>
    console.log(JSON.stringify({ index, ...item }))
  );
} else {
  const flow = await ControlFlow.load(scriptPath);
  if (!flow.has(startLabel)) {
    console.error(`label not found: ${startLabel}`);
    Deno.exit(1);
  }
  for (const block of flow.reachable(startLabel)) {
    console.log(JSON.stringify(block));
  }
}
