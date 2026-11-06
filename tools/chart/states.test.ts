import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";

/**
 * @module
 * Tests for the state machine of the chart assembler. Needs the tree-sitter-gta3 wasm named by `SBL_WASM` in `.env`:
 * `deno test -R -E --env-file=.env tools/chart/states.test.ts`
 */
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const fixture = new ChartAssembler(
  join(import.meta.dirname!, "fixtures", "states", "main.txt"),
  wasm,
);
const fixtureLines = Deno.readTextFileSync(
  join(import.meta.dirname!, "fixtures", "states", "main.txt"),
).split(/\r?\n/);

/** The 1-based line of the first line equal to `text` at or after the line `after`. */
const lineOf = (text: string, after = 0): number => {
  const index = fixtureLines.findIndex((l, i) => i >= after && l === text);
  assert(index >= 0, `${text} is not in the fixture`);
  return index + 1;
};

Deno.test("a mission with no marks is one state, and a wait does not split it", async () => {
  assertEquals(await fixture.states("alpha", []), {
    states: [{ transitions: [] }],
    errors: [],
  });
});

Deno.test("a mark begins a state, and guards come from the branches that reach it", async () => {
  assertEquals(
    await fixture.states("alpha", [{ statementText: "$c = 3", label: "Late" }]),
    {
      states: [
        {
          transitions: [
            { guard: "", target: "Late" },
            { guard: "When not $ok == 1", target: "Late" },
          ],
        },
        { label: "Late", transitions: [] },
      ],
      errors: [
        { kind: "unphrased", severity: "error", expression: "$ok == 1" },
      ],
    },
  );
});

Deno.test("an unlabeled state is named by its ordinal, and a mark on the first statement drops the start state", async () => {
  const { states } = await fixture.states("alpha", [
    { statementText: "script_name 'Alpha'", label: "Open" },
    { statementText: "$c = 3" },
  ]);
  assertEquals(states.map((s) => s.label), ["Open", undefined]);
  assertEquals(states[0].transitions.map((t) => t.target), [
    "State 2",
    "State 2",
  ]);
});

Deno.test("an orphaned mark begins no state", async () => {
  const { states } = await fixture.states("alpha", [
    { statementText: "$nope = 9", label: "Gone" },
  ]);
  assertEquals(states.length, 1);
});

Deno.test("a subroutine reached from two states through gosub is a warning", async () => {
  const { states, errors } = await fixture.states("beta", [
    { statementText: "$a = 1", label: "One" },
    { statementText: "$m = 1", label: "Two" },
  ]);
  assertEquals(states.map((s) => s.label), [undefined, "One", "Two"]);
  assertEquals(errors, [
    {
      kind: "reach",
      file: "main.txt",
      line: lineOf("$e = 5"),
      severity: "warning",
      states: ["One", "Two"],
    },
    {
      kind: "reach",
      file: "main.txt",
      line: lineOf("return"),
      severity: "warning",
      states: ["One", "Two"],
    },
  ]);
});

Deno.test("a statement reached from two states by control flow is an error", async () => {
  const { states, errors } = await fixture.states("gamma", [
    { statementText: "$a = 1", label: "One" },
    { statementText: "$m = 1", label: "Two" },
  ]);
  assertEquals(states[1].transitions, []);
  assertEquals(errors, [
    {
      kind: "reach",
      file: "main.txt",
      line: lineOf("$n = 2"),
      severity: "error",
      states: ["One", "Two"],
    },
    {
      kind: "reach",
      file: "main.txt",
      line: lineOf("terminate_this_script", lineOf("$n = 2")),
      severity: "error",
      states: ["One", "Two"],
    },
  ]);
});

const phrased = new ChartAssembler(
  join(import.meta.dirname!, "fixtures", "states", "main.txt"),
  wasm,
  {
    phrasebook: join(
      import.meta.dirname!,
      "fixtures",
      "states",
      "Phrasebook.csv",
    ),
  },
);

Deno.test("a boolean flag compared with 0 uses the flag's one Phrasebook row, written from its opposite", async () => {
  assertEquals(
    await phrased.states("delta", [{ statementText: "$z = 1", label: "Done" }]),
    {
      states: [
        {
          transitions: [{ guard: "When the flag is raised", target: "Done" }],
        },
        { label: "Done", transitions: [] },
      ],
      errors: [],
    },
  );
});
