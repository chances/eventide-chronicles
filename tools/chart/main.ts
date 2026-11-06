// Mission chart command.
// Usage: deno task chart <mission> [--missions <dir>]
// Reads <dir>/<mission>.chart.json (default dir: missions) and stops with a message
// when its schema version is unknown or its content is invalid.
import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { ChartSchema, SchemaError, UnknownVersionError } from "./schema.ts";

const args = parseArgs(Deno.args, { string: ["missions"] });
const [mission] = args._ as string[];
if (!mission) {
  console.error("usage: deno task chart <mission> [--missions <dir>]");
  Deno.exit(1);
}
const path = join(args.missions ?? "missions", `${mission}.chart.json`);
let text: string;
try {
  text = await Deno.readTextFile(path);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  console.log(`no chart file at ${path}`);
  Deno.exit(0);
}
try {
  new ChartSchema().check(JSON.parse(text));
} catch (error) {
  if (error instanceof UnknownVersionError || error instanceof SchemaError) {
    console.error(`${path}: ${error.message}`);
    Deno.exit(1);
  }
  throw error;
}
console.log(`${path}: valid`);
