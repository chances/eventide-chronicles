import { assertEquals } from "@std/assert";
import { Image } from "@cross/image";
import { join } from "@std/path";
import { padToSectors, sameBytes } from "./img.ts";
import { buildTxd, mipChain } from "./skin-format.ts";

// Runs scripts/install-skins.ts against a fake game folder. Each test makes its
// own folders under the temp directory and leaves them there.

async function readIfExists(path: string): Promise<Uint8Array | null> {
  try {
    return await Deno.readFile(path);
  } catch {
    return null;
  }
}

const stockDff = await readIfExists("skins/IGMerc.dff");
const stockTxd = await readIfExists("skins/IGMerc.txd");
const hasStock = stockDff !== null && stockTxd !== null;

// A TXD with one solid-color texture, so it differs from the stock one.
function solidTxd(name: string): Uint8Array {
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([200, 40, 40, 255], i);
  return buildTxd([{ name, levels: mipChain(Image.fromRGBA(256, 256, rgba)) }]);
}

async function tempFolder(label: string): Promise<string> {
  return await Deno.makeTempDir({ prefix: `install-skins-${label}-` });
}

// A fake game folder whose archive holds the stock IGMerc.dff and IGMerc.txd.
async function fakeGame(): Promise<string> {
  const dff = padToSectors(stockDff!);
  const txd = padToSectors(stockTxd!);
  const dir = new Uint8Array(64);
  const view = new DataView(dir.buffer);
  const encoder = new TextEncoder();
  view.setUint32(0, 0, true);
  view.setUint32(4, dff.length / 2048, true);
  dir.set(encoder.encode("IGMerc.dff"), 8);
  view.setUint32(32, dff.length / 2048, true);
  view.setUint32(36, txd.length / 2048, true);
  dir.set(encoder.encode("IGMerc.txd"), 40);
  const img = new Uint8Array(dff.length + txd.length);
  img.set(dff, 0);
  img.set(txd, dff.length);
  const game = await tempFolder("game");
  await Deno.mkdir(join(game, "models"));
  await Deno.writeFile(join(game, "models", "gta3.dir"), dir);
  await Deno.writeFile(join(game, "models", "gta3.img"), img);
  return game;
}

async function run(game: string, from: string, ...flags: string[]) {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-read",
      "--allow-write",
      "scripts/install-skins.ts",
      "--from",
      from,
      ...flags,
    ],
    env: { VC: game },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  return {
    code: output.code,
    text: decoder.decode(output.stdout) + decoder.decode(output.stderr),
  };
}

async function snapshot(game: string) {
  return {
    dir: await Deno.readFile(join(game, "models", "gta3.dir")),
    img: await Deno.readFile(join(game, "models", "gta3.img")),
  };
}

async function backupExists(game: string): Promise<boolean> {
  return (await readIfExists(join(game, "models", "gta3.dir.eventide-bak"))) !==
    null;
}

function names(text: string, verb: string): string[] {
  return [...text.matchAll(new RegExp(`${verb} (\\S+)`, "g"))].map((m) => m[1])
    .sort();
}

Deno.test({
  name: "a dry run names what the real run installs, and writes nothing",
  ignore: !hasStock,
  fn: async () => {
    const game = await fakeGame();
    const from = await tempFolder("from");
    await Deno.writeFile(join(from, "IGMerc.txd"), solidTxd("igmerc"));
    const before = await snapshot(game);

    const dry = await run(game, from, "--dry-run");
    assertEquals(dry.code, 0);
    const afterDry = await snapshot(game);
    assertEquals(sameBytes(afterDry.dir, before.dir), true);
    assertEquals(sameBytes(afterDry.img, before.img), true);
    assertEquals(await backupExists(game), false);

    const real = await run(game, from);
    assertEquals(real.code, 0);
    assertEquals(
      names(dry.text, "Would install"),
      names(real.text, "Installed"),
    );
    const afterReal = await snapshot(game);
    assertEquals(afterReal.img.length > before.img.length, true);
    assertEquals(
      sameBytes(
        await Deno.readFile(join(game, "models", "gta3.dir.eventide-bak")),
        before.dir,
      ),
      true,
    );

    const again = await run(game, from);
    assertEquals(
      again.text.includes("Skipped IGMerc.txd (already installed)"),
      true,
    );
    assertEquals(names(again.text, "Installed"), []);
  },
});

Deno.test({
  name:
    "a texture the mesh does not ask for stops the dry run and the real run alike",
  ignore: !hasStock,
  fn: async () => {
    const game = await fakeGame();
    const from = await tempFolder("from");
    await Deno.writeFile(join(from, "outfits.dff"), stockDff!);
    await Deno.writeFile(join(from, "outfits.txd"), solidTxd("striped_utility"));
    const before = await snapshot(game);

    const dry = await run(game, from, "--dry-run");
    const real = await run(game, from);
    assertEquals([dry.code, real.code], [1, 1]);
    assertEquals(dry.text, real.text);
    assertEquals(
      dry.text.includes(
        "outfits.dff asks for texture igmerc, and outfits.txd has none",
      ),
      true,
    );
    const after = await snapshot(game);
    assertEquals(sameBytes(after.dir, before.dir), true);
    assertEquals(sameBytes(after.img, before.img), true);
    assertEquals(await backupExists(game), false);
  },
});

Deno.test({
  name: "a lone new texture file is skipped the same way by both runs",
  ignore: !hasStock,
  fn: async () => {
    const game = await fakeGame();
    const from = await tempFolder("from");
    await Deno.writeFile(join(from, "outfits.txd"), solidTxd("striped_utility"));
    const before = await snapshot(game);

    const dry = await run(game, from, "--dry-run");
    const real = await run(game, from);
    assertEquals([dry.code, real.code], [0, 0]);
    assertEquals(dry.text, real.text);
    assertEquals(
      dry.text.includes("Skipped outfits: a new model needs both"),
      true,
    );
    const after = await snapshot(game);
    assertEquals(sameBytes(after.dir, before.dir), true);
    assertEquals(sameBytes(after.img, before.img), true);
  },
});
