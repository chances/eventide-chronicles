/**
 * @module
 * Mission chart command.
 *
 * Usage: `deno task chart <mission> [--missions <dir>] [--entry <file>] [--cleo-dir <dir>]... [--memory <MB>] [--timeout <seconds>] [--phrasebook <file>] [--library <file>]`
 *
 * Guards are written in Gherkin English from `--phrasebook` (default `Phrasebook.csv`), with argument
 * names from `--library` (default: `data/vc_sbl/vc.json` under the folder of `SANNY`). A condition with no
 * Phrasebook row shows its source text and is listed in the chart's `errors` as unphrased.
 *
 * Rewrites the derived content of `<dir>/<mission>.chart.json` (default dir: `missions`) from the
 * script at `<file>` (default: `main.txt`) and keeps its marks. Stops with a message when an
 * existing file has an unknown schema version or invalid content, and lists orphaned marks on stderr.
 * The effect traces are enumerated by `traces.ts` under the capped runner, with a memory cap of
 * `--memory` megabytes (default 1500) and a timeout of `--timeout` seconds (default 300). A run that
 * trips either cap stops the command and writes nothing. Windows only, since the capped runner is.
 */
import { parseArgs } from "@std/cli/parse-args";
import { dirname, join } from "@std/path";
import { exists } from "@std/fs";
import { ChartAssembler } from "./assembler.ts";
import { type DerivedContent, MarksMerger } from "./marks.ts";
import { PageRenderer } from "./render.ts";
import {
  type ChartFile,
  ChartSchema,
  SchemaError,
  UnknownVersionError,
} from "./schema.ts";

const args = parseArgs(Deno.args, {
  string: [
    "missions",
    "entry",
    "cleo-dir",
    "memory",
    "timeout",
    "phrasebook",
    "library",
  ],
  collect: ["cleo-dir"],
});
const [mission] = args._ as string[];
if (!mission) {
  console.error(
    "usage: deno task chart <mission> [--missions <dir>] [--entry <file>] [--cleo-dir <dir>]... [--memory <MB>] [--timeout <seconds>]",
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
const entry = args.entry ?? "main.txt";
const cleoDirs = args["cleo-dir"] ?? ["lib/threads"];
const phrasebook = args.phrasebook ?? "Phrasebook.csv";
const sanny = Deno.env.get("SANNY");
const library = args.library ??
  (sanny ? join(dirname(sanny), "data", "vc_sbl", "vc.json") : undefined);
const assembler = new ChartAssembler(entry, wasm, {
  cleoDirs,
  phrasebook: await exists(phrasebook) ? phrasebook : undefined,
  library: library && await exists(library) ? library : undefined,
});

/** Runs `traces.ts` under the capped runner and returns the traces it wrote, or stops the command. */
async function cappedTraces(): Promise<ChartFile["traces"]> {
  const out = await Deno.makeTempFile({ suffix: ".json" });
  try {
    const { code } = await new Deno.Command("deno", {
      args: [
        "task",
        "--cwd",
        "tools/flow-model",
        "capped",
        "--cwd=../..",
        args.memory ?? "1500",
        args.timeout ?? "300",
        Deno.execPath(),
        "run",
        "--env-file=.env",
        "--allow-env",
        "--allow-read",
        "--allow-write",
        "tools/chart/traces.ts",
        mission,
        "--out",
        out,
        "--entry",
        entry,
        ...cleoDirs.flatMap((d) => ["--cleo-dir", d]),
      ],
      stdin: "null",
      stdout: "inherit",
      stderr: "inherit",
    }).output();
    if (code !== 0) {
      console.error(
        `traces for ${mission} stopped with exit code ${code}; ${path} was not written`,
      );
      Deno.exit(1);
    }
    return JSON.parse(await Deno.readTextFile(out));
  } finally {
    await Deno.remove(out);
  }
}
const { states, errors } = await assembler.states(
  mission,
  existing?.marks ?? [],
);
const derived: DerivedContent = {
  version: 1,
  mission,
  globals: await assembler.globals(mission),
  states,
  launchSites: await assembler.launchSites(mission),
  conflicts: await assembler.conflicts(mission),
  errors,
  traces: await cappedTraces(),
};
const statements = await assembler.statements(mission);
const { chart, orphans } = new MarksMerger().merge(
  existing,
  derived,
  statements,
);
await Deno.writeTextFile(
  path,
  JSON.stringify(schema.check(chart), null, 2) + "\n",
);
const pagePath = join("dist", "charts", `${mission}.html`);
await Deno.mkdir(dirname(pagePath), { recursive: true });
await Deno.writeTextFile(
  pagePath,
  new PageRenderer(chart, statements).render(),
);
for (const mark of orphans) {
  console.error(`orphaned mark: ${JSON.stringify(mark.statementText)}`);
}
console.log(
  `${path}: ${chart.globals.length} globals, ${chart.marks.length} marks, ${orphans.length} orphaned`,
);
