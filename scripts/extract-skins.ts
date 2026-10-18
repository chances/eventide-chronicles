import { join } from "@std/path";

// Extracts character models and textures from gta3.img in the game folder.
// Each name gets its .dff and .txd copied out, and every texture in the .txd
// is decoded to a PNG. Usage: deno task extract-skins [--out dir] [name ...]

const SECTOR = 2048;
const DEFAULT_NAMES = ["IGMerc"];

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

const args = [...Deno.args];
let outDir = "skins";
const outFlag = args.indexOf("--out");
if (outFlag !== -1) {
  outDir = args[outFlag + 1];
  args.splice(outFlag, 2);
}
const names = args.length > 0 ? args : DEFAULT_NAMES;

interface ImgEntry {
  name: string;
  offset: number;
  size: number;
}

async function readDirectory(): Promise<Map<string, ImgEntry>> {
  const bytes = await Deno.readFile(join(vc!, "models", "gta3.dir"));
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = new Map<string, ImgEntry>();
  for (let i = 0; i + 32 <= bytes.length; i += 32) {
    const name = decoder.decode(bytes.slice(i + 8, i + 32)).replace(/\0.*/s, "");
    entries.set(name.toLowerCase(), {
      name,
      offset: view.getUint32(i, true) * SECTOR,
      size: view.getUint32(i + 4, true) * SECTOR,
    });
  }
  return entries;
}

async function readEntry(img: Deno.FsFile, entry: ImgEntry): Promise<Uint8Array> {
  const data = new Uint8Array(entry.size);
  await img.seek(entry.offset, Deno.SeekMode.Start);
  let read = 0;
  while (read < data.length) {
    const count = await img.read(data.subarray(read));
    if (count === null) break;
    read += count;
  }
  return data;
}

interface Texture {
  name: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}

const CHUNK_STRUCT = 0x01;
const CHUNK_TEXTURE_NATIVE = 0x15;
const CHUNK_TEXTURE_DICTIONARY = 0x16;

function decodeTxd(txd: Uint8Array): Texture[] {
  const view = new DataView(txd.buffer, txd.byteOffset, txd.byteLength);
  if (view.getUint32(0, true) !== CHUNK_TEXTURE_DICTIONARY) {
    throw new Error("Not a texture dictionary");
  }
  // Dictionary struct chunk: header, then u16 texture count and u16 device id.
  const count = view.getUint16(12 + 12, true);
  const textures: Texture[] = [];
  let pos = 12 + 12 + 4;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== CHUNK_TEXTURE_NATIVE) {
      throw new Error(`Expected a native texture at ${pos}`);
    }
    const size = view.getUint32(pos + 4, true);
    textures.push(decodeNativeTexture(txd.subarray(pos + 12, pos + 12 + size)));
    pos += 12 + size;
  }
  return textures;
}

function decodeNativeTexture(chunk: Uint8Array): Texture {
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if (view.getUint32(0, true) !== CHUNK_STRUCT) {
    throw new Error("Native texture has no struct chunk");
  }
  let p = 12;
  const platform = view.getUint32(p, true);
  if (platform !== 8 && platform !== 9) {
    throw new Error(`Unsupported texture platform ${platform}`);
  }
  p += 8; // platform id and filter flags
  const decoder = new TextDecoder();
  const name = decoder.decode(chunk.slice(p, p + 32)).replace(/\0.*/s, "");
  p += 64; // name and mask name
  const rasterFormat = view.getUint32(p, true);
  p += 4;
  const d3dFormat = view.getUint32(p, true);
  p += 4;
  const width = view.getUint16(p, true);
  const height = view.getUint16(p + 2, true);
  const depth = chunk[p + 4];
  const compression = chunk[p + 7];
  p += 8;

  const paletted = (rasterFormat & 0x2000) !== 0 || (rasterFormat & 0x4000) !== 0;
  let palette: Uint8Array | null = null;
  if (paletted) {
    palette = chunk.slice(p, p + 1024);
    p += 1024;
  }
  const dataSize = view.getUint32(p, true);
  const data = chunk.subarray(p + 4, p + 4 + dataSize);
  const rgba = new Uint8Array(width * height * 4);

  const dxt = platform === 9 ? dxtFromFourCc(d3dFormat) : compression;
  if (dxt) {
    decodeDxt(data, width, height, dxt, rgba);
  } else if (paletted && palette) {
    for (let i = 0; i < width * height; i++) {
      const index = depth === 4 ? (data[i >> 1] >> ((i & 1) * 4)) & 0xf : data[i];
      rgba[i * 4] = palette[index * 4];
      rgba[i * 4 + 1] = palette[index * 4 + 1];
      rgba[i * 4 + 2] = palette[index * 4 + 2];
      rgba[i * 4 + 3] = palette[index * 4 + 3];
    }
  } else if (depth === 32) {
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = data[i * 4 + 2];
      rgba[i * 4 + 1] = data[i * 4 + 1];
      rgba[i * 4 + 2] = data[i * 4];
      rgba[i * 4 + 3] = data[i * 4 + 3];
    }
  } else if (depth === 16) {
    const format = (rasterFormat >> 8) & 0xf;
    for (let i = 0; i < width * height; i++) {
      const v = data[i * 2] | (data[i * 2 + 1] << 8);
      if (format === 2) {
        rgba[i * 4] = ((v >> 11) & 31) * 255 / 31;
        rgba[i * 4 + 1] = ((v >> 5) & 63) * 255 / 63;
        rgba[i * 4 + 2] = (v & 31) * 255 / 31;
        rgba[i * 4 + 3] = 255;
      } else if (format === 3) {
        rgba[i * 4] = ((v >> 8) & 15) * 17;
        rgba[i * 4 + 1] = ((v >> 4) & 15) * 17;
        rgba[i * 4 + 2] = (v & 15) * 17;
        rgba[i * 4 + 3] = ((v >> 12) & 15) * 17;
      } else {
        rgba[i * 4] = ((v >> 10) & 31) * 255 / 31;
        rgba[i * 4 + 1] = ((v >> 5) & 31) * 255 / 31;
        rgba[i * 4 + 2] = (v & 31) * 255 / 31;
        rgba[i * 4 + 3] = (v & 0x8000) ? 255 : 0;
      }
    }
  } else {
    throw new Error(`Unsupported texture ${name}: depth ${depth}, format ${rasterFormat}`);
  }
  return { name, width, height, rgba };
}

function dxtFromFourCc(fourCc: number): number {
  const text = String.fromCharCode(
    fourCc & 255,
    (fourCc >> 8) & 255,
    (fourCc >> 16) & 255,
    (fourCc >> 24) & 255,
  );
  const match = /^DXT([1-5])$/.exec(text);
  return match ? Number(match[1]) : 0;
}

function expand565(v: number): [number, number, number] {
  return [
    Math.round(((v >> 11) & 31) * 255 / 31),
    Math.round(((v >> 5) & 63) * 255 / 63),
    Math.round((v & 31) * 255 / 31),
  ];
}

function decodeDxt(data: Uint8Array, width: number, height: number, type: number, out: Uint8Array) {
  const blockSize = type === 1 ? 8 : 16;
  const blocksWide = Math.max(1, width >> 2);
  const blocksHigh = Math.max(1, height >> 2);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let by = 0; by < blocksHigh; by++) {
    for (let bx = 0; bx < blocksWide; bx++) {
      const base = (by * blocksWide + bx) * blockSize;
      const colorBase = type === 1 ? base : base + 8;
      const c0 = view.getUint16(colorBase, true);
      const c1 = view.getUint16(colorBase + 2, true);
      const [r0, g0, b0] = expand565(c0);
      const [r1, g1, b1] = expand565(c1);
      const palette: number[][] = [[r0, g0, b0, 255], [r1, g1, b1, 255]];
      if (c0 > c1 || type !== 1) {
        palette.push([(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255]);
        palette.push([(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]);
      } else {
        palette.push([(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255]);
        palette.push([0, 0, 0, 0]);
      }
      const indices = view.getUint32(colorBase + 4, true);
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          const y = by * 4 + py;
          if (x >= width || y >= height) continue;
          const color = palette[(indices >> (2 * (py * 4 + px))) & 3];
          let alpha = color[3];
          if (type === 2 || type === 3) {
            const bits = view.getUint16(base + py * 2, true);
            alpha = ((bits >> (px * 4)) & 15) * 17;
          } else if (type === 4 || type === 5) {
            alpha = dxt5Alpha(view, base, py * 4 + px);
          }
          const o = (y * width + x) * 4;
          out[o] = color[0];
          out[o + 1] = color[1];
          out[o + 2] = color[2];
          out[o + 3] = alpha;
        }
      }
    }
  }
}

function dxt5Alpha(view: DataView, base: number, index: number): number {
  const a0 = view.getUint8(base);
  const a1 = view.getUint8(base + 1);
  let bits = 0n;
  for (let i = 0; i < 6; i++) bits |= BigInt(view.getUint8(base + 2 + i)) << BigInt(8 * i);
  const code = Number((bits >> BigInt(3 * index)) & 7n);
  if (code === 0) return a0;
  if (code === 1) return a1;
  if (a0 > a1) return ((8 - code) * a0 + (code - 1) * a1) / 7;
  if (code === 6) return 0;
  if (code === 7) return 255;
  return ((6 - code) * a0 + (code - 1) * a1) / 5;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

async function encodePng(texture: Texture): Promise<Uint8Array> {
  const { width, height, rgba } = texture;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const compressed = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

const directory = await readDirectory();
const img = await Deno.open(join(vc, "models", "gta3.img"), { read: true });
await Deno.mkdir(outDir, { recursive: true });
try {
  for (const name of names) {
    for (const extension of ["dff", "txd"]) {
      const entry = directory.get(`${name}.${extension}`.toLowerCase());
      if (!entry) {
        console.error(`No ${name}.${extension} in gta3.dir`);
        continue;
      }
      const bytes = await readEntry(img, entry);
      await Deno.writeFile(join(outDir, entry.name), bytes);
      console.log(`Extracted ${entry.name} (${entry.size} bytes)`);
      if (extension !== "txd") continue;
      for (const texture of decodeTxd(bytes)) {
        const file = join(outDir, `${entry.name.replace(/\.txd$/i, "")}_${texture.name}.png`);
        await Deno.writeFile(file, await encodePng(texture));
        console.log(`Decoded ${texture.name} ${texture.width}x${texture.height} to ${file}`);
      }
    }
  }
} finally {
  img.close();
}
