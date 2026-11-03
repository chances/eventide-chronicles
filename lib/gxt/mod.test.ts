import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { GxtReader } from "./gxt.ts";

const vc = Deno.env.get("VC");
const americanPath = `${vc}\\TEXT\\american.gxt`;

function readAmerican(): GxtReader {
  return new GxtReader(Deno.readFileSync(americanPath));
}

Deno.test("american.gxt has 79 tables", () => {
  assertEquals(readAmerican().tables().length, 79);
});

Deno.test("MAIN has 2490 keys and the whole file has 4748", () => {
  const reader = readAmerican();
  const tables = reader.tables();
  const main = tables.find((t) => t.name === "MAIN");
  assertEquals(main !== undefined, true);
  assertEquals(reader.entries(main!).length, 2490);
  const total = tables.reduce((sum, t) => sum + reader.entries(t).length, 0);
  assertEquals(total, 4748);
});

Deno.test("MAIN key A1_A reads its English text", () => {
  const reader = readAmerican();
  const main = reader.tables().find((t) => t.name === "MAIN")!;
  const row = reader.entries(main).find((r) => r.key === "A1_A");
  assertEquals(row?.text, "Kill the ~g~ Psycho!");
});

Deno.test("a file without a TABL header throws naming the header", () => {
  const reader = new GxtReader(new Uint8Array(16));
  let message = "";
  try {
    reader.tables();
  } catch (error) {
    message = (error as Error).message;
  }
  assertStringIncludes(message, "TABL");
});

Deno.test("a table with no TDAT block throws naming the table", () => {
  const bytes = new Uint8Array(64);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("TABL"), 0);
  view.setUint32(4, 12, true);
  bytes.set(new TextEncoder().encode("BROKEN"), 8);
  view.setUint32(16, 24, true);
  bytes.set(new TextEncoder().encode("TKEY"), 24);
  view.setUint32(28, 0, true);
  const reader = new GxtReader(bytes);
  const table = reader.tables()[0];
  let message = "";
  try {
    reader.entries(table);
  } catch (error) {
    message = (error as Error).message;
  }
  assertStringIncludes(message, "BROKEN");
});
