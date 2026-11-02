import { assertEquals, assertThrows } from "@std/assert";
import { Image } from "@cross/image";
import { cropTile, findEdges } from "./sheet.ts";

// A 100x60 dark sheet with a bright panel on pixels x 30 to 69, y 10 to 49.
function sampleSheet(): Image {
  const data = new Uint8Array(100 * 60 * 4);
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 100; x++) {
      const inside = x >= 30 && x < 70 && y >= 10 && y < 50;
      data.set(
        inside ? [200, 200, 200, 255] : [20, 20, 20, 255],
        (y * 100 + x) * 4,
      );
    }
  }
  return Image.fromRGBA(100, 60, data);
}

Deno.test("findEdges reports the first pixel after each step", () => {
  const window = { x0: 0, y0: 10, x1: 100, y1: 50 };
  const cuts = findEdges(sampleSheet(), "x", window, 2).map((e) => e.cut).sort(
    (a, b) => a - b,
  );
  assertEquals(cuts, [30, 70]);
});

Deno.test("findEdges finds horizontal steps", () => {
  const window = { x0: 30, y0: 0, x1: 70, y1: 60 };
  const cuts = findEdges(sampleSheet(), "y", window, 2).map((e) => e.cut).sort(
    (a, b) => a - b,
  );
  assertEquals(cuts, [10, 50]);
});

Deno.test("cropTile cuts a tile and scales it to a square", () => {
  const tile = { name: "panel", x: 30, y: 10, width: 40, height: 40 };
  const piece = cropTile(sampleSheet(), tile, 8);
  assertEquals([piece.width, piece.height], [8, 8]);
  assertEquals(piece.data[0], 200);
});

Deno.test("cropTile rejects a tile outside the sheet", () => {
  const tile = { name: "wide", x: 90, y: 0, width: 20, height: 20 };
  assertThrows(() => cropTile(sampleSheet(), tile), Error, "outside");
});
