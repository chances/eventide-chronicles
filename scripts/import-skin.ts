import { basename, join } from "@std/path";
import { encode } from "@nktkas/bmp";
import {
  buildTxd,
  dffTextureNames,
  readTexture,
  type SourceTexture,
} from "./skin-format.ts";

// Builds <name>.txd from PNG files. Each PNG becomes one texture. The texture
// name is the file name without ".png", minus a leading "<name>_" (the prefix
// extract-skins adds). The names must match what <name>.dff asks for.
// --base <Model> makes <name> a new outfit of an existing model: it copies
// <out>/<Model>.dff to <out>/<name>.dff and names the single PNG's texture
// after the one texture that dff asks for, so every outfit reuses the mesh.
// Usage: deno task import-skin <name> <png> [<png> ...] [--out dir] [--base Model]

const args = [...Deno.args];
function takeFlag(flag: string): string | undefined {
  const at = args.indexOf(flag);
  if (at === -1) return undefined;
  const value = args[at + 1];
  args.splice(at, 2);
  return value;
}
const outDir = takeFlag("--out") ?? "skins";
const base = takeFlag("--base");
const [name, ...pngs] = args;
if (!name || pngs.length === 0) {
  console.error(
    "Usage: deno task import-skin <name> <png> [<png> ...] [--out dir] [--base Model]",
  );
  Deno.exit(1);
}

let baseTexture: string | undefined;
if (base) {
  const wanted = dffTextureNames(
    await Deno.readFile(join(outDir, `${base}.dff`)),
  );
  if (wanted.length !== 1 || pngs.length !== 1) {
    console.error(
      `--base needs a model with one texture and one PNG. ${base}.dff asks for ${wanted.length}, and ${pngs.length} PNGs were given.`,
    );
    Deno.exit(1);
  }
  baseTexture = wanted[0];
}

function textureName(path: string): string {
  if (baseTexture) return baseTexture;
  const stem = basename(path).replace(/\.png$/i, "");
  const prefix = `${name}_`;
  return stem.toLowerCase().startsWith(prefix.toLowerCase())
    ? stem.slice(prefix.length)
    : stem;
}

const textures: SourceTexture[] = [];
for (const path of pngs) {
  textures.push(
    await readTexture(textureName(path), await Deno.readFile(path)),
  );
}

const dffPath = join(outDir, `${name}.dff`);
if (base) {
  await Deno.copyFile(join(outDir, `${base}.dff`), dffPath);
  console.log(`Copied ${base}.dff to ${dffPath}`);
}
try {
  const wanted = new Set(
    dffTextureNames(await Deno.readFile(dffPath)).map((n) => n.toLowerCase()),
  );
  const given = new Set(textures.map((t) => t.name.toLowerCase()));
  for (const n of given) {
    if (!wanted.has(n)) {
      throw new Error(`${dffPath} never asks for a texture named ${n}`);
    }
  }
  for (const n of wanted) {
    if (!given.has(n)) {
      console.warn(`${dffPath} asks for ${n} and no PNG supplies it`);
    }
  }
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  console.warn(`No ${dffPath}, so texture names are not checked`);
}

await Deno.mkdir(outDir, { recursive: true });
const txd = buildTxd(textures);
const outPath = join(outDir, `${name}.txd`);
await Deno.writeFile(outPath, txd);
for (const t of textures) {
  console.log(`Packed ${t.name} ${t.levels[0].width}x${t.levels[0].height}`);
}
console.log(`Wrote ${outPath} (${txd.length} bytes)`);

// The game reads models/generic/player.bmp, not player.txd, for the default
// player model, so the player slot also gets a 24-bit bitmap of its texture.
if (name.toLowerCase() === "player" && textures.length === 1) {
  const { width, height, rgba } = textures[0].levels[0];
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb.set(rgba.subarray(i * 4, i * 4 + 3), i * 3);
  }
  const bmpPath = join(outDir, "player.bmp");
  await Deno.writeFile(
    bmpPath,
    encode({ width, height, channels: 3, data: rgb }, { bitsPerPixel: 24 }),
  );
  console.log(`Wrote ${bmpPath}`);
}
