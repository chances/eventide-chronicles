/**
 * @module
 * Effect traces of one mission, written to a file.
 *
 * Usage: `deno run --env-file=.env --allow-env --allow-read --allow-write tools/chart/traces.ts <mission> --out <file> [--entry <file>] [--cleo-dir <dir>]... [--trigger-bound <n>] [--mission-bound <n>]`
 *
 * `tools/chart/main.ts` runs this command under the capped runner, because enumerating every trace of a
 * mission script can exhaust memory.
 */
import { parseArgs } from "@std/cli/parse-args";
import { ChartAssembler } from "./assembler.ts";

const args = parseArgs(Deno.args, {
  string: [
    "out",
    "entry",
    "cleo-dir",
    "trigger-bound",
    "mission-bound",
  ],
  collect: ["cleo-dir"],
});
const [mission] = args._ as string[];
if (!mission || !args.out) {
  console.error(
    "usage: traces.ts <mission> --out <file> [--entry <file>] [--cleo-dir <dir>]... [--trigger-bound <n>] [--mission-bound <n>]",
  );
  Deno.exit(2);
}
const wasm = Deno.env.get("SBL_WASM");
if (!wasm) {
  console.error(
    "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env",
  );
  Deno.exit(2);
}
const bound = (value: string | undefined) =>
  value === undefined ? undefined : Number(value);
const assembler = new ChartAssembler(args.entry ?? "main.txt", wasm, {
  cleoDirs: args["cleo-dir"] ?? ["lib/threads"],
  triggerBound: bound(args["trigger-bound"]),
  missionBound: bound(args["mission-bound"]),
});
await Deno.writeTextFile(
  args.out,
  JSON.stringify(await assembler.traces(mission)),
);
