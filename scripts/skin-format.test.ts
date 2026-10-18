import { assertEquals } from "@std/assert";
import { Image } from "@cross/image";
import {
  addEntry,
  listEntries,
  parseDirectory,
  placeEntry,
  SECTOR,
} from "./img.ts";
import {
  buildTxd,
  dffTextureNames,
  mipChain,
  txdTextureNames,
} from "./skin-format.ts";

function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

// The stock files are extracted into skins/ by `deno task extract-skins`.
const hasStock = await exists("skins/IGMerc.txd");

Deno.test({
  name: "buildTxd matches the layout of the stock IGMerc.txd",
  ignore: !hasStock,
  fn: async () => {
    const stock = await Deno.readFile("skins/IGMerc.txd");
    const levels = mipChain(
      Image.fromRGBA(256, 256, new Uint8Array(256 * 256 * 4).fill(255)),
    );
    const built = buildTxd([{ name: "igmerc", levels }]);
    assertEquals(built.length, u32(stock, 4) + 12);
    assertEquals(built.slice(0, 80), stock.slice(0, 80));
    // Native header: raster format, alpha flag, size, depth, mips, type, compression.
    assertEquals(built.slice(52 + 72, 52 + 88), stock.slice(52 + 72, 52 + 88));
  },
});

Deno.test({
  name: "dffTextureNames reads the stock IGMerc.dff",
  ignore: !(await exists("skins/IGMerc.dff")),
  fn: async () => {
    const dff = await Deno.readFile("skins/IGMerc.dff");
    assertEquals(dffTextureNames(dff), ["igmerc"]);
  },
});

Deno.test({
  name: "txdTextureNames reads the stock IGMerc.txd",
  ignore: !hasStock,
  fn: async () => {
    const txd = await Deno.readFile("skins/IGMerc.txd");
    assertEquals(txdTextureNames(txd), ["igmerc"]);
  },
});

// A directory with A.txd at sector 5 (2 sectors long) and a duplicate B.dff.
function sampleDirectory(): Uint8Array {
  const dir = new Uint8Array(96);
  const view = new DataView(dir.buffer);
  const encoder = new TextEncoder();
  view.setUint32(0, 5, true);
  view.setUint32(4, 2, true);
  dir.set(encoder.encode("A.txd"), 8);
  for (const slot of [32, 64]) {
    view.setUint32(slot, 9, true);
    view.setUint32(slot + 4, 1, true);
    dir.set(encoder.encode("B.dff"), slot + 8);
  }
  return dir;
}

Deno.test("parseDirectory returns every entry that shares a name", () => {
  assertEquals(parseDirectory(sampleDirectory()).get("b.dff")?.length, 2);
});

Deno.test("placeEntry appends an entry that was never moved", () => {
  const dir = sampleDirectory();
  const original = listEntries(dir.slice());
  const entry = parseDirectory(dir).get("a.txd")![0];
  const { padded, offset } = placeEntry(
    dir,
    SECTOR * 100,
    entry,
    original[0],
    new Uint8Array(SECTOR + 1),
  );
  assertEquals([padded.length, offset], [SECTOR * 2, SECTOR * 100]);
  const after = parseDirectory(dir).get("a.txd")![0];
  assertEquals([after.offset, after.size], [SECTOR * 100, SECTOR * 2]);
});

Deno.test("addEntry adds a directory entry that placeEntry fills", () => {
  const added = addEntry(sampleDirectory(), "New.txd");
  assertEquals(added.dir.length, 128);
  const { offset } = placeEntry(
    added.dir,
    SECTOR * 100,
    added.entry,
    undefined,
    new Uint8Array(10),
  );
  assertEquals(offset, SECTOR * 100);
  const [after] = parseDirectory(added.dir).get("new.txd")!;
  assertEquals([after.index, after.offset, after.size], [
    3,
    SECTOR * 100,
    SECTOR,
  ]);
});

Deno.test("placeEntry reuses a moved entry while the data fits", () => {
  const dir = sampleDirectory();
  const original = listEntries(dir.slice());
  const entry = parseDirectory(dir).get("a.txd")![0];
  placeEntry(dir, SECTOR * 100, entry, original[0], new Uint8Array(SECTOR * 2));
  const again = placeEntry(
    dir,
    SECTOR * 102,
    entry,
    original[0],
    new Uint8Array(SECTOR),
  );
  assertEquals(again.offset, SECTOR * 100);
  const bigger = placeEntry(
    dir,
    SECTOR * 102,
    entry,
    original[0],
    new Uint8Array(SECTOR * 3),
  );
  assertEquals(bigger.offset, SECTOR * 102);
});
