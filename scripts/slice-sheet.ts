import { join } from "@std/path";
import { parseArgs } from "@std/cli/parse-args";
import { parse } from "@std/csv/parse";
import { Image } from "@cross/image";
import { cropTile, findEdges, type Tile } from "./sheet.ts";

// Slices a composite sheet into one PNG per tile.
//   deno task slice-sheet edges <sheet> <x0> <y0> <x1> <y1>
//     Lists the strongest vertical and horizontal cuts in a window, to find
//     where each panel starts and stops.
//   deno task slice-sheet cut <sheet> <manifest.csv> [--out dir] [--size n]
//     Writes <out>/<name>.png for each manifest row. The manifest columns are
//     name, x, y, width, height, in sheet pixels. --size scales each tile to
//     a square of n pixels (default 512). Output goes to dist/<manifest stem>/.

const args = parseArgs(Deno.args, { string: ["out", "size"] });
const [command, sheetPath, ...rest] = args._.map(String);
if (!sheetPath || (command !== "edges" && command !== "cut")) {
  console.error(
    "Usage: deno task slice-sheet edges <sheet> <x0> <y0> <x1> <y1>\n" +
      "       deno task slice-sheet cut <sheet> <manifest.csv> [--out dir] [--size n]",
  );
  Deno.exit(1);
}

const sheet = await Image.decode(await Deno.readFile(sheetPath));

if (command === "edges") {
  const [x0, y0, x1, y1] = rest.map(Number);
  if ([x0, y0, x1, y1].some(Number.isNaN)) {
    console.error("Give the window as four numbers: x0 y0 x1 y1");
    Deno.exit(1);
  }
  const window = { x0, y0, x1, y1 };
  for (const axis of ["x", "y"] as const) {
    console.log(`${axis} cuts in ${x0},${y0} to ${x1},${y1}:`);
    for (const edge of findEdges(sheet, axis, window)) {
      console.log(
        `  ${axis}=${edge.cut}  strength ${edge.strength.toFixed(1)}`,
      );
    }
  }
} else {
  const manifestPath = rest[0];
  if (!manifestPath) {
    console.error("Give the manifest .csv file");
    Deno.exit(1);
  }
  const size = Number(args.size ?? 512);
  const rows = parse(await Deno.readTextFile(manifestPath), {
    skipFirstRow: true,
  });
  const stem = manifestPath.replace(/^.*[\\/]/, "").replace(/\.csv$/i, "");
  const outDir = args.out ?? join("dist", stem);
  await Deno.mkdir(outDir, { recursive: true });
  for (const row of rows) {
    const tile: Tile = {
      name: row.name,
      x: Number(row.x),
      y: Number(row.y),
      width: Number(row.width),
      height: Number(row.height),
    };
    const piece = cropTile(sheet, tile, size);
    const file = join(outDir, `${tile.name}.png`);
    await Deno.writeFile(file, await piece.encode("png"));
    console.log(
      `Wrote ${file} from ${tile.width}x${tile.height} at ${tile.x},${tile.y}`,
    );
  }
}
