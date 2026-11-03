// Thread and mission graph of a Sanny Builder program, as JSON.
// Usage: deno task --cwd tools/thread-graph start ../../main.txt [--wasm <file>] [--vars $A,$B] [--outline A,B] [--cleo-dir lib/threads]
// --wasm       tree-sitter-gta3 wasm build; defaults to the SBL_WASM environment variable (set in .env)
// --vars       global variables whose reads and writes are recorded
// --outline    entry labels whose reachable statements are recorded in full
// --cleo-dir   folder, relative to the main script, that holds streamed CLEO script sources (repeatable)
import { parseArgs } from "@std/cli/parse-args";
import { ThreadGraph } from "./graph.ts";

const args = parseArgs(Deno.args, {
  string: ["wasm", "vars", "outline", "cleo-dir"],
  collect: ["cleo-dir"],
});
const [entry] = args._ as string[];
const wasm = args.wasm ?? Deno.env.get("SBL_WASM");
if (!entry || !wasm) {
  console.error(
    "usage: deno task --cwd tools/thread-graph start <main.txt> [--wasm <file>] [--vars $A,$B] [--outline A,B] [--cleo-dir <dir>]",
  );
  Deno.exit(1);
}
const split = (list?: string) =>
  list ? list.split(",").map((s) => s.trim()).filter(Boolean) : [];
const graph = new ThreadGraph(entry, wasm, {
  trackedVars: split(args.vars),
  outline: split(args.outline),
  cleoDirs: args["cleo-dir"].length ? args["cleo-dir"] : ["lib/threads"],
});
console.log(JSON.stringify(await graph.build(), null, 2));
