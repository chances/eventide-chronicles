import { assert, assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";
import { type DerivedContent, MarksMerger, type Statement } from "./marks.ts";
import { ChartSchema } from "./schema.ts";

/**
 * @module
 * Tests for the marks merger. Needs the tree-sitter-gta3 wasm named by `SBL_WASM` in `.env`:
 * `deno test -R -E -W --allow-run --env-file=.env tools/chart/marks.test.ts`
 */
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const derived: DerivedContent = {
  version: 1,
  mission: "alpha",
  traceBound: 24,
  globals: [{ name: "$a", accessor: "Alpha", kind: "write" }],
  states: [],
  launchSites: [],
  conflicts: [],
  traces: [],
};

const stmt = (text: string, line: number): Statement => ({
  text,
  file: "m.txt",
  line,
  occurrence: 1,
  copies: 1,
});

const merger = new MarksMerger();

Deno.test("a mark stores the statement text and an optional label", () => {
  const schema = new ChartSchema();
  const base = { ...derived, states: [] };
  schema.check({ ...base, marks: [{ statementText: "wait 0" }] });
  schema.check({
    ...base,
    marks: [{ statementText: "wait 0", label: "Beat" }],
  });
  schema.check({
    ...base,
    marks: [{
      statementText: "wait 0",
      occurrence: 2,
      orphaned: true,
    }],
  });
});

Deno.test("a run rewrites the derived content and leaves every mark as it was", () => {
  const marks = [{ statementText: "wait 1", label: "Second" }, {
    statementText: "wait 0",
    occurrence: 2,
  }];
  const existing = {
    ...derived,
    globals: [{ name: "$old", accessor: "Gone", kind: "read" as const }],
    marks,
  };
  const statements = [stmt("wait 1", 3), stmt("wait 0", 4), {
    ...stmt("wait 0", 5),
    occurrence: 2,
    copies: 2,
  }];
  const result = merger.merge(existing, derived, statements);
  assertEquals(result.chart.globals, derived.globals);
  assertEquals(result.chart.marks, marks);
  assertEquals(result.orphans, []);
});

Deno.test("with no earlier file a run starts with no marks", () => {
  assertEquals(merger.merge(undefined, derived, []).chart.marks, []);
});

Deno.test("after a source edit that moves a statement, the mark follows it", () => {
  const marks = [{ statementText: "$a = 2" }];
  const existing = { ...derived, marks };
  const before = merger.merge(existing, derived, [stmt("$a = 2", 10)]);
  const after = merger.merge(existing, derived, [stmt("$a = 2", 14)]);
  assertEquals(before.anchors[0]?.line, 10);
  assertEquals(after.anchors[0]?.line, 14);
  assertEquals(after.chart.marks, marks);
});

Deno.test("whitespace differences do not break the anchor", () => {
  const existing = { ...derived, marks: [{ statementText: "$a   =\n 2" }] };
  const result = merger.merge(existing, derived, [stmt("$a = 2", 1)]);
  assertEquals(result.orphans, []);
  assertEquals(result.anchors[0]?.line, 1);
});

Deno.test("a mark whose statement is gone is flagged orphaned and stays in the chart", () => {
  const existing = {
    ...derived,
    marks: [{ statementText: "$a = 2", label: "Gone" }, {
      statementText: "wait 0",
    }],
  };
  const result = merger.merge(existing, derived, [stmt("wait 0", 1)]);
  assertEquals(result.chart.marks, [
    { statementText: "$a = 2", label: "Gone", orphaned: true },
    { statementText: "wait 0" },
  ]);
  assertEquals(result.orphans.map((m) => m.statementText), ["$a = 2"]);
  assertEquals(result.anchors[0], null);

  const back = merger.merge(result.chart, derived, [
    stmt("wait 0", 1),
    stmt("$a = 2", 2),
  ]);
  assertEquals(back.chart.marks[0], {
    statementText: "$a = 2",
    label: "Gone",
  });
  assertEquals(back.orphans, []);
});

Deno.test("an orphan leaves the chart only when its removal is confirmed", () => {
  const existing = {
    ...derived,
    marks: [{ statementText: "$a = 2", orphaned: true }, {
      statementText: "wait 0",
    }],
  };
  const kept = merger.merge(existing, derived, [stmt("wait 0", 1)]);
  assertEquals(kept.chart.marks.length, 2);
  const removed = merger.remove(kept.chart, { statementText: "$a = 2" });
  assertEquals(removed.marks, [{ statementText: "wait 0" }]);
  assertThrows(
    () => merger.remove(removed, { statementText: "$a = 2" }),
    Error,
    "$a = 2",
  );
});

Deno.test("two identical statements anchor by order of appearance", () => {
  const twins = MarksMerger.number([
    { text: "wait 0", file: "m.txt", line: 1 },
    { text: "wait 0", file: "m.txt", line: 2 },
    { text: "wait 1", file: "m.txt", line: 3 },
  ]);
  assertEquals(twins.map((s) => [s.occurrence, s.copies]), [
    [1, 2],
    [2, 2],
    [1, 1],
  ]);
  const existing = {
    ...derived,
    marks: [
      { statementText: "wait 0" },
      { statementText: "wait 0", occurrence: 2 },
      { statementText: "wait 0", occurrence: 3 },
    ],
  };
  const result = merger.merge(existing, derived, twins);
  assertEquals(result.anchors.map((a) => a?.line ?? null), [1, 2, null]);
  assertEquals(result.chart.marks[2].orphaned, true);
});

const header = `DEFINE MISSIONS 2
DEFINE MISSION 0 AT @Zero
DEFINE MISSION 1 AT @Alpha

script_name 'Main'
start_new_script @Watcher
terminate_this_script

:Watcher
script_name 'Watcher'
wait 0
Mission.LoadAndLaunchInternal(1)
terminate_this_script

:Zero
script_name 'Zero'
terminate_this_script

:Alpha
script_name 'Alpha'
`;

async function assemblerFor(body: string): Promise<ChartAssembler> {
  const dir = await Deno.makeTempDir();
  const entry = join(dir, "main.txt");
  await Deno.writeTextFile(entry, header + body);
  return new ChartAssembler(entry, wasm!);
}

const body = `$a = 1
if
  $a == 1
then
  wait 0
  $a = 2
end
wait 0
terminate_this_script
`;

Deno.test("the command writes the globals into the chart file and keeps its marks", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = join(dir, "alpha.chart.json");
    const marks = [{ statementText: "$score += 5", label: "Score" }, {
      statementText: "$gone = 1",
    }];
    await Deno.writeTextFile(
      file,
      JSON.stringify({ ...derived, marks, globals: [] }),
    );
    const out = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-R",
        "-W",
        "-E",
        join(import.meta.dirname!, "main.ts"),
        "alpha",
        "--missions",
        dir,
        "--entry",
        join(import.meta.dirname!, "fixtures", "globals", "main.txt"),
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(out.success, true, new TextDecoder().decode(out.stderr));
    const written = JSON.parse(await Deno.readTextFile(file));
    assertEquals(written.globals.length, 6);
    assertEquals(written.marks, [marks[0], { ...marks[1], orphaned: true }]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("the assembler lists leaf statements and compound headers in order of appearance", async () => {
  const statements = await (await assemblerFor(body)).statements("alpha");
  assertEquals(statements.map((s) => s.text), [
    "script_name 'Alpha'",
    "$a = 1",
    "if $a == 1",
    "wait 0",
    "$a = 2",
    "wait 0",
    "terminate_this_script",
  ]);
  assertEquals(
    statements.filter((s) => s.text === "wait 0").map((s) => [
      s.occurrence,
      s.copies,
    ]),
    [[1, 2], [2, 2]],
  );
});

Deno.test("a mark follows its statement through a source edit and orphans when the statement is deleted", async () => {
  const marks = [{ statementText: "$a = 2", label: "Second" }];
  const original = await (await assemblerFor(body)).statements("alpha");
  const first = merger.merge(
    { ...derived, marks },
    derived,
    original,
  );

  const moved =
    await (await assemblerFor(body.replace("$a = 1\n", "$a = 1\n$b = 5\n")))
      .statements("alpha");
  const afterMove = merger.merge(first.chart, derived, moved);
  assertEquals(afterMove.chart.marks, marks);
  assertEquals(
    afterMove.anchors[0]!.line,
    first.anchors[0]!.line + 1,
  );

  const deleted = await (await assemblerFor(body.replace("  $a = 2\n", "")))
    .statements("alpha");
  const afterDelete = merger.merge(afterMove.chart, derived, deleted);
  assertEquals(afterDelete.orphans.map((m) => m.statementText), ["$a = 2"]);
  assertEquals(afterDelete.chart.marks.length, 1);
});
