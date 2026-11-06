import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { join } from "@std/path";
import { ChartSchema, UnknownVersionError } from "./schema.ts";

const root = join(import.meta.dirname!, "..", "..");
const here = import.meta.dirname!;

const sample = {
  version: 1,
  mission: "alpha",
  globals: [{ name: "$ONMISSION", accessor: "Star", kind: "read" }],
  marks: [{ statementText: "wait 0" }, {
    statementText: "wait 1",
    label: "Second",
  }],
  states: [{
    label: "Second",
    transitions: [{ guard: "$ONMISSION == 0", target: "Second" }],
  }],
  launchSites: [{ file: "main.txt", line: 1, thread: "Star", guardLines: [1] }],
  conflicts: [{
    pair: "mission-thread",
    accesses: [{ file: "a.txt", line: 1, kind: "read" }, {
      file: "b.txt",
      line: 2,
      kind: "write",
    }],
  }],
  traces: [{
    script: "Star",
    lock: "free",
    bound: 12,
    cut: true,
    effects: ["launch(1)"],
  }],
};

Deno.test("tools/chart is a workspace package named @eventide/chart", async () => {
  const rootJson = JSON.parse(await Deno.readTextFile(join(root, "deno.json")));
  assert(rootJson.workspace.includes("./tools/chart"));
  const pkg = JSON.parse(await Deno.readTextFile(join(here, "deno.json")));
  assertEquals(pkg.name, "@eventide/chart");
});

Deno.test("a file at a known version passes the schema", () => {
  assertEquals(new ChartSchema().check(sample).mission, "alpha");
});

Deno.test("a file with an unknown version stops with a message that names it", () => {
  const error = assertThrows(
    () => new ChartSchema().check({ ...sample, version: 99 }),
    UnknownVersionError,
  );
  assertStringIncludes(error.message, "99");
});

Deno.test("a file with no version field is rejected", () => {
  const { version: _version, ...rest } = sample;
  assertThrows(() => new ChartSchema().check(rest));
});

Deno.test("a file with a bad conflict pair is rejected", () => {
  const bad = {
    ...sample,
    conflicts: [{ ...sample.conflicts[0], pair: "nonsense" }],
  };
  assertThrows(() => new ChartSchema().check(bad));
});

Deno.test("the command takes the mission as an argument and stops on an unknown version", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      join(dir, "zeta.chart.json"),
      JSON.stringify({ ...sample, version: 99 }),
    );
    const out = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-R", join(here, "main.ts"), "zeta", "--missions", dir],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(out.success, false);
    assertStringIncludes(new TextDecoder().decode(out.stderr), "99");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("no non-test source file in tools/chart names a mission", async () => {
  const names = /\b(Intro|Cop|Hotel|BossDie)\b/;
  for await (const entry of Deno.readDir(here)) {
    if (
      !entry.isFile || !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts")
    ) continue;
    const text = await Deno.readTextFile(join(here, entry.name));
    assertEquals(names.test(text), false, `${entry.name} names a mission`);
  }
});

Deno.test("AGENTS.md has a run line for tools/chart", async () => {
  assertStringIncludes(
    await Deno.readTextFile(join(root, "AGENTS.md")),
    "tools/chart",
  );
});
