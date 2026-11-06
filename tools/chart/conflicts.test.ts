import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";

/**
 * @module
 * Tests for the conflict report of the chart assembler. Needs the tree-sitter-gta3 wasm named by `SBL_WASM` in `.env`:
 * `deno test -R -E --env-file=.env tools/chart/conflicts.test.ts`
 */
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const fixture = new ChartAssembler(
  join(import.meta.dirname!, "fixtures", "conflicts", "main.txt"),
  wasm,
);

const site = (
  script: string,
  line: number,
  kind: "read" | "write",
) => ({ script, file: "main.txt", line, kind });

Deno.test("conflicts lists each pair with its global and both access sites", async () => {
  assertEquals(await fixture.conflicts("alpha"), [
    {
      pair: "mission-thread",
      global: "$both",
      accesses: [site("Alpha", 62, "read"), site("WriterA", 24, "write")],
    },
    {
      pair: "mission-thread",
      global: "$both",
      accesses: [site("Alpha", 62, "read"), site("WriterB", 30, "write")],
    },
    {
      pair: "mission-thread",
      global: "$shared",
      accesses: [site("Alpha", 61, "write"), site("Reader", 18, "read")],
    },
    {
      pair: "thread-thread",
      global: "$both",
      accesses: [site("WriterA", 24, "write"), site("WriterB", 30, "write")],
    },
    {
      pair: "trigger-mission",
      global: "$ONMISSION",
      accesses: [site("Unguarded", 51, "write")],
    },
  ]);
});

Deno.test("two reads of a global are not a mission-thread conflict", async () => {
  const globals = (await fixture.conflicts("alpha")).map((c) => c.global);
  assert(!globals.includes("$roval"));
});

Deno.test("a script of kind mission is never on the thread side", async () => {
  const scripts = (await fixture.conflicts("alpha"))
    .filter((c) => c.pair !== "trigger-mission")
    .flatMap((c) => c.accesses.map((a) => a.script));
  assert(!scripts.includes("Zero"), "mission 0 writes $both");
  assert(!scripts.includes("Beta"));
});

Deno.test("a launch with an $ONMISSION read in its guard lines is not a conflict", async () => {
  const launches = (await fixture.conflicts("alpha"))
    .filter((c) => c.pair === "trigger-mission")
    .map((c) => c.accesses[0].script);
  assertEquals(launches, ["Unguarded"]);
});

Deno.test("a mission that touches no shared global has only the trigger-mission conflict", async () => {
  assertEquals(
    (await fixture.conflicts("beta")).map((c) => c.pair),
    ["trigger-mission"],
  );
});
