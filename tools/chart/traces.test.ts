/**
 * @module
 * Tests for the traces command and the chart command's use of it. Needs the tree-sitter-gta3 wasm named
 * by `SBL_WASM` in `.env` and Windows job objects for the capped runner:
 * `deno test -R -W -E -N --allow-run --allow-ffi --env-file=.env tools/chart/traces.test.ts`
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ChartSchema } from "./schema.ts";

const root = join(import.meta.dirname!, "..", "..");
const entry = join(import.meta.dirname!, "fixtures", "triggers", "main.txt");
const windows = Deno.build.os === "windows";

async function run(args: string[]) {
  const out = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--env-file=.env",
      "--allow-env",
      "--allow-read",
      "--allow-write",
      "--allow-run",
      "--allow-ffi",
      ...args,
    ],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
  };
}

Deno.test("the traces command writes the traces of a mission to a file", async () => {
  const dir = await Deno.makeTempDir();
  const file = join(dir, "traces.json");
  const { code, stderr } = await run([
    "tools/chart/traces.ts",
    "alpha",
    "--out",
    file,
    "--entry",
    entry,
  ]);
  assertEquals(code, 0, stderr);
  const traces = JSON.parse(await Deno.readTextFile(file));
  assert(traces.length > 0);
  assert(
    traces.every((t: { script: string }) =>
      ["Trigger", "Alpha"].includes(t.script)
    ),
  );
});

Deno.test({
  name: "the chart command writes the traces into the mission's chart file",
  ignore: !windows,
  fn: async () => {
    const dir = await Deno.makeTempDir();
    const { code, stderr } = await run([
      "tools/chart/main.ts",
      "alpha",
      "--missions",
      dir,
      "--entry",
      entry,
    ]);
    assertEquals(code, 0, stderr);
    const chart = new ChartSchema().check(
      JSON.parse(await Deno.readTextFile(join(dir, "alpha.chart.json"))),
    );
    assert(chart.traces.length > 0, "the chart file has no traces");
    assert(
      chart.traces.some((t) => t.script === "Trigger" && t.lock === "held"),
    );
    assert(chart.traces.some((t) => t.script === "Alpha" && t.lock === "held"));
  },
});

Deno.test({
  name: "the chart command stops and names the cap when the memory cap fires",
  ignore: !windows,
  fn: async () => {
    const dir = await Deno.makeTempDir();
    const { code, stderr } = await run([
      "tools/chart/main.ts",
      "alpha",
      "--missions",
      dir,
      "--entry",
      entry,
      "--memory",
      "64",
    ]);
    assert(code !== 0, "a 64 MB cap should stop the run");
    assert(stderr.includes("memory cap of 64 MB"), stderr);
  },
});
