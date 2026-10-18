import { basename, join } from "@std/path";
import {
  buildTxd,
  dffTextureNames,
  readTexture,
  type SourceTexture,
} from "./skin-format.ts";

// Builds <name>.txd from PNG files. Each PNG becomes one texture. The texture
// name is the file name without ".png", minus a leading "<name>_" (the prefix
// extract-skins adds). The names must match what <name>.dff asks for.
// Usage: deno task import-skin <name> <png> [<png> ...] [--out dir]

const args = [...Deno.args];
let outDir = "skins";
const outFlag = args.indexOf("--out");
if (outFlag !== -1) {
  outDir = args[outFlag + 1];
  args.splice(outFlag, 2);
}
const [name, ...pngs] = args;
if (!name || pngs.length === 0) {
  console.error(
    "Usage: deno task import-skin <name> <png> [<png> ...] [--out dir]",
  );
  Deno.exit(1);
}

function textureName(path: string): string {
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
