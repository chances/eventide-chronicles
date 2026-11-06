/**
 * @module
 * Mission chart command.
 *
 * Usage: `deno task chart <mission> [--missions <dir>] [--entry <file>] [--cleo-dir <dir>]...`
 *
 * Rewrites the derived content of `<dir>/<mission>.chart.json` (default dir: `missions`) from the
 * script at `<file>` (default: `main.txt`) and keeps its marks. Stops with a message when an
 * existing file has an unknown schema version or invalid content, and lists orphaned marks on stderr.
 */
import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";
import { type DerivedContent, MarksMerger } from "./marks.ts";
import {
  type ChartFile,
  ChartSchema,
  SchemaError,
  UnknownVersionError,
} from "./schema.ts";

const args = parseArgs(Deno.args, {
  string: ["missions", "entry", "cleo-dir"],
  collect: ["cleo-dir"],
});
const [mission] = args._ as string[];
if (!mission) {
  console.error(
    "usage: deno task chart <mission> [--missions <dir>] [--entry <file>] [--cleo-dir <dir>]...",
  );
  Deno.exit(1);
}
const path = join(args.missions ?? "missions", `${mission}.chart.json`);
const schema = new ChartSchema();
let existing: ChartFile | undefined;
try {
  existing = schema.check(JSON.parse(await Deno.readTextFile(path)));
} catch (error) {
  if (error instanceof UnknownVersionError || error instanceof SchemaError) {
    console.error(`${path}: ${error.message}`);
    Deno.exit(1);
  }
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
const wasm = Deno.env.get("SBL_WASM");
if (!wasm) {
  console.error(
    "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env",
  );
  Deno.exit(1);
}
const assembler = new ChartAssembler(args.entry ?? "main.txt", wasm, {
  cleoDirs: args["cleo-dir"] ?? ["lib/threads"],
});
const derived: DerivedContent = {
  version: 1,
  mission,
  globals: await assembler.globals(mission),
  states: existing?.states ?? [],
  launchSites: await assembler.launchSites(mission),
  conflicts: existing?.conflicts ?? [],
  traces: existing?.traces ?? [],
};
const { chart, orphans } = new MarksMerger().merge(
  existing,
  derived,
  await assembler.statements(mission),
);
await Deno.writeTextFile(
  path,
  JSON.stringify(schema.check(chart), null, 2) + "\n",
);
for (const mark of orphans) {
  console.error(`orphaned mark: ${JSON.stringify(mark.statementText)}`);
}
console.log(
  `${path}: ${chart.globals.length} globals, ${chart.marks.length} marks, ${orphans.length} orphaned`,
);
