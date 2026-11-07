/**
 * @module
 * Golden test for the derived chart of missions 1 to 6. Runs `tools/chart/main.ts` on each mission into a
 * temporary folder and compares the derived content with `lib/fixtures/chart/<mission>.json`. Line numbers
 * are stored for review and not compared, so an edit that only shifts lines passes.
 *
 * Needs the tree-sitter-gta3 wasm named by `SBL_WASM` in `.env`, and the capped runner, which is Windows
 * only. Run it from the repository root:
 *   deno test -R -W -E --allow-run --env-file=.env tools/chart/golden.test.ts
 * After a deliberate change, review the diff, then rewrite the fixtures:
 *   UPDATE_FIXTURE=1 deno test -R -W -E --allow-run --env-file=.env tools/chart/golden.test.ts
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";

const root = join(import.meta.dirname!, "..", "..");
const fixtureDir = join(root, "lib", "fixtures", "chart");
const missions = ["intro", "cop", "hotel", "work", "cart", "bossdie"];
const update = Deno.env.get("UPDATE_FIXTURE") === "1";
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

/** Drops every `line` key, at any depth, so an edit that only shifts lines compares equal. */
function stripLines(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLines);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "line")
        .map(([key, child]) => [key, stripLines(child)]),
    );
  }
  return value;
}

/** Runs the chart command for one mission into a temporary folder and returns the chart it wrote. */
async function derive(mission: string): Promise<unknown> {
  const dir = await Deno.makeTempDir();
  try {
    const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--env-file=.env",
        "--allow-env",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "tools/chart/main.ts",
        mission,
        "--missions",
        dir,
      ],
      cwd: root,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(
      code,
      0,
      `chart ${mission} exited ${code}: ${new TextDecoder().decode(stderr)}${
        new TextDecoder().decode(stdout)
      }`,
    );
    return JSON.parse(
      await Deno.readTextFile(join(dir, `${mission}.chart.json`)),
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

for (const mission of missions) {
  Deno.test(`${mission} derives the stored golden chart`, async () => {
    const derived = await derive(mission);
    const fixturePath = join(fixtureDir, `${mission}.json`);
    if (update) {
      await Deno.mkdir(fixtureDir, { recursive: true });
      await Deno.writeTextFile(
        fixturePath,
        JSON.stringify(derived, null, 2) + "\n",
      );
      return;
    }
    const golden = JSON.parse(await Deno.readTextFile(fixturePath));
    assertEquals(stripLines(derived), stripLines(golden));
  });
}
