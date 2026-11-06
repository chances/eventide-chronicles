import { assertEquals } from "@std/assert";
import {
  GuardWriter,
  parseCondition,
  Phrasebook,
  suggestPhrase,
} from "./guards.ts";

/**
 * @module
 * Tests for guard text: boolean flag normalization, Phrasebook phrases, library argument names, and `logi.js` minimization.
 */
const book = Phrasebook.parse(
  [
    "expression,nominal,opposite,active",
    "$F,the flag is set,the flag is clear,the flag is raised",
    "Player.IsPlaying,the player is playing,the player is not playing,the player starts playing",
    "Player.LocateOnFoot3D,the player is on foot near,the player is not on foot near,the player enters on foot",
    "$TIMER == 0,the timer has run out,the timer is running,the timer runs out",
  ].join("\n"),
);
const library = new Map<string, string[]>([
  ["Player.IsPlaying", ["self"]],
  [
    "Player.LocateOnFoot3D",
    ["self", "x", "y", "z", "xRadius", "yRadius", "zRadius", "drawSphere"],
  ],
]);
const writer = new GuardWriter(book, new Set(["$F"]), library);

Deno.test("a boolean flag compared with 1 or 0 is the flag or its negation", () => {
  const flags = new Set(["$F"]);
  assertEquals(parseCondition("$F == 1", flags), {
    key: "$F",
    negated: false,
    args: [],
    source: "$F == 1",
  });
  assertEquals(parseCondition("$F == 0", flags).negated, true);
  assertEquals(parseCondition("not $F == 1", flags).negated, true);
  assertEquals(parseCondition("not $F == 0", flags).negated, false);
  assertEquals(parseCondition("$F != 0", flags).negated, false);
  assertEquals(parseCondition("$TIMER == 0", flags).key, "$TIMER == 0");
});

Deno.test("a call is keyed by its command, with its arguments split at top-level commas", () => {
  const c = parseCondition(
    "Player.LocateOnFoot3D($PLAYER1, 395.0, -906.2, 12.0, 3.0, 3.0, 3.0, False)",
    new Set(),
  );
  assertEquals(c.key, "Player.LocateOnFoot3D");
  assertEquals(c.args.length, 8);
});

Deno.test("a single condition uses the active phrase, or the opposite phrase when negated", () => {
  assertEquals(
    writer.write("single", ["$F == 1"], false).text,
    "When the flag is raised",
  );
  assertEquals(
    writer.write("single", ["$F == 0"], false).text,
    "When the flag is clear",
  );
  assertEquals(
    writer.write("single", ["$F == 1"], true).text,
    "When the flag is clear",
  );
});

Deno.test("an and chain is When then And lines, and its negation is one When line per alternative", () => {
  assertEquals(
    writer.write("and", ["Player.IsPlaying($PLAYER1)", "$F == 1"], false).text,
    "When the player starts playing\nAnd the flag is set",
  );
  assertEquals(
    writer.write("and", ["Player.IsPlaying($PLAYER1)", "$F == 1"], true).text,
    "When the player is not playing\nWhen the flag is clear",
  );
});

Deno.test("an or chain is one When line per alternative, and its negation is When then And lines", () => {
  assertEquals(
    writer.write("or", ["Player.IsPlaying($PLAYER1)", "$F == 1"], false).text,
    "When the player starts playing\nWhen the flag is raised",
  );
  assertEquals(
    writer.write("or", ["Player.IsPlaying($PLAYER1)", "$F == 1"], true).text,
    "When the player is not playing\nAnd the flag is clear",
  );
});

Deno.test("arguments follow the phrase with library names, points and radii grouped, and the instance dropped", () => {
  assertEquals(
    writer.write(
      "single",
      ["Player.LocateOnFoot3D($PLAYER1, 395.0, -906.2, 12.0, 3.0, 3.0, 3.0, False)"],
      false,
    ).text,
    "When the player enters on foot (395.0, -906.2, 12.0), radius (3.0, 3.0, 3.0), drawSphere False",
  );
});

Deno.test("a condition with no phrase shows its source text and is listed as unphrased", () => {
  const out = writer.write("single", ["$ok == 1"], true);
  assertEquals(out.text, "When not $ok == 1");
  assertEquals(out.unphrased, ["$ok == 1"]);
});

Deno.test("suggestPhrase derives compromise suggestions for commands and flags", async () => {
  const descs = new Map([
    ["Player.IsPlaying", "Checks if the player is playing."],
  ]);
  const p1 = await suggestPhrase("Player.IsPlaying($PLAYER1)", descs);
  assertEquals(p1.nominal, "the player is playing");
  assertEquals(p1.opposite, "the player is not playing");
  assertEquals(p1.active, "");

  const p2 = await suggestPhrase("$FLAG == 1");
  assertEquals(p2.nominal, "$FLAG is set");
  assertEquals(p2.opposite, "$FLAG is not set");
  assertEquals(p2.active, "");
});
