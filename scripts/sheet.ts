// Measures and slices composite sheets: one image that holds several textures.
import { Image } from "@cross/image";

export interface Tile {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edge {
  cut: number;
  strength: number;
}

function luminance(image: Image, x: number, y: number): number {
  const o = (y * image.width + x) * 4;
  const { data } = image;
  return 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
}

// Finds the strongest straight steps in brightness inside a window of the
// image. A cut is the first pixel after a step, so a panel that spans pixels
// s to e has a cut at s on its left and a cut at e + 1 on its right. Edges
// closer than `minGap` pixels to a stronger one are dropped.
export function findEdges(
  image: Image,
  axis: "x" | "y",
  window: { x0: number; y0: number; x1: number; y1: number },
  count = 8,
  minGap = 8,
): Edge[] {
  const { x0, y0, x1, y1 } = window;
  const profile: Edge[] = [];
  if (axis === "x") {
    for (let x = x0; x < x1 - 1; x++) {
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        sum += Math.abs(luminance(image, x + 1, y) - luminance(image, x, y));
      }
      profile.push({ cut: x + 1, strength: sum / (y1 - y0) });
    }
  } else {
    for (let y = y0; y < y1 - 1; y++) {
      let sum = 0;
      for (let x = x0; x < x1; x++) {
        sum += Math.abs(luminance(image, x, y + 1) - luminance(image, x, y));
      }
      profile.push({ cut: y + 1, strength: sum / (x1 - x0) });
    }
  }
  const picked: Edge[] = [];
  for (const edge of profile.sort((a, b) => b.strength - a.strength)) {
    if (picked.length === count) break;
    if (picked.every((p) => Math.abs(p.cut - edge.cut) >= minGap)) {
      picked.push(edge);
    }
  }
  return picked;
}

// Crops one tile out of a sheet. With `size`, the tile is scaled to a square
// of that many pixels, which a texture needs because its sides are powers of
// two.
export function cropTile(image: Image, tile: Tile, size?: number): Image {
  const { x, y, width, height } = tile;
  if (
    x < 0 || y < 0 || width <= 0 || height <= 0 ||
    x + width > image.width || y + height > image.height
  ) {
    throw new Error(
      `${tile.name} (${x},${y} ${width}x${height}) is outside the ${image.width}x${image.height} sheet`,
    );
  }
  const piece = image.clone().crop(x, y, width, height);
  return size
    ? piece.resize({ width: size, height: size, method: "bicubic" })
    : piece;
}
