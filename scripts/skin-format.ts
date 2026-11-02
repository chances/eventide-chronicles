// Builds the RenderWare texture dictionary a Vice City character skin needs.
// Pixel work comes from packages: @cross/image reads PNGs and scales mip
// levels, dxtn compresses to DXT, and rw-parser-ng reads the DFF. No package
// writes a TXD, so this file only wraps the compressed pixels in RenderWare
// chunks.
import { Buffer } from "node:buffer";
import { Image } from "@cross/image";
import { compressDXT1, compressDXT3 } from "dxtn";
import { DffParser, TxdParser } from "rw-parser-ng";

const CHUNK_STRUCT = 0x01;
const CHUNK_EXTENSION = 0x03;
const CHUNK_TEXTURE_NATIVE = 0x15;
const CHUNK_TEXTURE_DICTIONARY = 0x16;

// Library stamp 3.4.0.3, the version Vice City writes into its own files.
const VERSION = 0x1003ffff;
const PLATFORM_D3D8 = 8;
const FILTER_LINEAR_MIPMAP_WRAP = 0x1106;
const RASTER_AUTO_MIPMAP = 0x8000;
const RASTER_565 = 0x0200;
const RASTER_4444 = 0x0300;
const NATIVE_HEADER_SIZE = 88;

export interface Level {
  width: number;
  height: number;
  rgba: Uint8Array;
}

// One texture: its name and a mip chain from full size down to 1x1.
export interface SourceTexture {
  name: string;
  levels: Level[];
}

// Scales the image down by half per level until it is 1x1.
export function mipChain(image: Image): Level[] {
  const levels: Level[] = [];
  for (;;) {
    const { width, height, data } = image;
    levels.push({ width, height, rgba: new Uint8Array(data) });
    if (width === 1 && height === 1) return levels;
    image.resize({
      width: Math.max(1, width >> 1),
      height: Math.max(1, height >> 1),
    });
  }
}

export async function readTexture(
  name: string,
  png: Uint8Array,
): Promise<SourceTexture> {
  const image = await Image.decode(png, "png");
  const { width, height } = image;
  if ((width & (width - 1)) !== 0 || (height & (height - 1)) !== 0) {
    throw new Error(
      `${name} is ${width}x${height}. Vice City needs power-of-two sides.`,
    );
  }
  return { name, levels: mipChain(image) };
}

function chunk(type: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, type, true);
  view.setUint32(4, body.length, true);
  view.setUint32(8, VERSION, true);
  out.set(body, 12);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function hasTransparency(rgba: Uint8Array): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return true;
  return false;
}

// dxtn compresses whole 4x4 blocks, so the 2x2 and 1x1 mips grow to 4x4.
function padToBlock(level: Level): Level {
  if (level.width >= 4 && level.height >= 4) return level;
  const image = Image.fromRGBA(level.width, level.height, level.rgba).resize({
    width: Math.max(4, level.width),
    height: Math.max(4, level.height),
    method: "nearest",
  });
  const { width, height, data } = image;
  return { width, height, rgba: new Uint8Array(data) };
}

function buildNativeTexture(texture: SourceTexture): Uint8Array {
  const { name, levels } = texture;
  const alpha = hasTransparency(levels[0].rgba);
  const compress = alpha ? compressDXT3 : compressDXT1;
  const header = new Uint8Array(NATIVE_HEADER_SIZE);
  const view = new DataView(header.buffer);
  const nameBytes = new TextEncoder().encode(name);
  if (nameBytes.length > 31) {
    throw new Error(`Texture name ${name} is longer than 31 characters`);
  }
  view.setUint32(0, PLATFORM_D3D8, true);
  view.setUint32(4, FILTER_LINEAR_MIPMAP_WRAP, true);
  header.set(nameBytes, 8);
  view.setUint32(
    72,
    RASTER_AUTO_MIPMAP | (alpha ? RASTER_4444 : RASTER_565),
    true,
  );
  view.setUint32(76, alpha ? 1 : 0, true);
  view.setUint16(80, levels[0].width, true);
  view.setUint16(82, levels[0].height, true);
  header[84] = 16;
  header[85] = levels.length;
  header[86] = 4;
  header[87] = alpha ? 3 : 1;
  const parts: Uint8Array[] = [header];
  for (const level of levels) {
    const { width, height, rgba } = padToBlock(level);
    const data = compress(width, height, rgba) as Uint8Array;
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0, data.length, true);
    parts.push(size, data);
  }
  return concat([
    chunk(CHUNK_STRUCT, concat(parts)),
    chunk(CHUNK_EXTENSION, new Uint8Array(0)),
  ]);
}

// Builds a Vice City (D3D8, DXT) texture dictionary.
export function buildTxd(textures: SourceTexture[]): Uint8Array {
  const count = new Uint8Array(4);
  new DataView(count.buffer).setUint16(0, textures.length, true);
  return chunk(
    CHUNK_TEXTURE_DICTIONARY,
    concat([
      chunk(CHUNK_STRUCT, count),
      ...textures.map((texture) =>
        chunk(CHUNK_TEXTURE_NATIVE, buildNativeTexture(texture))
      ),
      chunk(CHUNK_EXTENSION, new Uint8Array(0)),
    ]),
  );
}

// Lists the texture names a DFF's materials ask for, in file order.
export function dffTextureNames(dff: Uint8Array): string[] {
  const parsed = new DffParser(Buffer.from(dff)).parse();
  return (parsed.geometryList?.geometries ?? []).flatMap((geometry) =>
    // rw-parser-ng types the list as `materials`; the parsed object uses `materialData`.
    (geometry.materialList as unknown as {
      materialData: { texture?: { textureName: string } }[];
    }).materialData.flatMap((material) =>
      material.texture ? [material.texture.textureName] : []
    )
  );
}

// Lists the texture names a TXD holds.
export function txdTextureNames(txd: Uint8Array): string[] {
  const parsed = new TxdParser(Buffer.from(txd)).parse();
  return parsed.textureDictionary.textureNatives.map((t) => t.textureName);
}
