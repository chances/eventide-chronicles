import { basename, join } from "@std/path";
import {
  addEntry,
  type DirEntry,
  listEntries,
  padToSectors,
  parseDirectory,
  placeEntry,
  readEntry,
  sameBytes,
} from "./img.ts";
import { dffTextureNames, txdTextureNames } from "./skin-format.ts";

// Installs every character model in the skins folder into the game's
// gta3.img. A model is a <name>.dff, a <name>.txd, or both. A name already in
// gta3.dir (player, player8, IGMerc, CSMerc, cop, chef, and so on) is replaced,
// and a texture-only reskin is a lone .txd. A name that gta3.dir lacks is a new
// model: it needs both files and at most 7 characters, and its entries are
// added to gta3.dir. A script loads a new model with Char.Undress. Before
// anything is written,
// each .dff is checked against its .txd so a missing texture name stops the
// install. Files already identical to the game's copy are skipped, so the
// task is safe to run on every install. The first write saves gta3.dir as
// gta3.dir.eventide-bak, and copying that file back restores the originals.
// --dry-run lists what would be installed and writes nothing.
// Usage: deno task install:skins [<name> ...] [--from dir] [--dry-run]

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

const args = [...Deno.args];
let fromDir = "skins";
const fromFlag = args.indexOf("--from");
if (fromFlag !== -1) {
  fromDir = args[fromFlag + 1];
  args.splice(fromFlag, 2);
}
const dryRun = args.includes("--dry-run");
const only = new Set(
  args.filter((arg) => arg !== "--dry-run").map((name) => name.toLowerCase()),
);

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

const dirPath = join(vc, "models", "gta3.dir");
const imgPath = join(vc, "models", "gta3.img");
const backupPath = `${dirPath}.eventide-bak`;
let dir = await Deno.readFile(dirPath);
const originalBytes = await exists(backupPath)
  ? await Deno.readFile(backupPath)
  : dir.slice();
const original = listEntries(originalBytes);
const entries = parseDirectory(dir);

const skins = new Map<string, { dff?: string; txd?: string }>();
for await (const file of Deno.readDir(fromDir)) {
  const match = /^(.+)\.(dff|txd)$/i.exec(file.name);
  if (!file.isFile || !match) continue;
  const stem = match[1].toLowerCase();
  if (only.size > 0 && !only.has(stem)) continue;
  const ext = match[2].toLowerCase() as "dff" | "txd";
  skins.set(stem, { ...skins.get(stem), [ext]: join(fromDir, file.name) });
}
if (skins.size === 0) {
  console.log(`No .dff or .txd files to install in ${fromDir}`);
  Deno.exit(0);
}

// The game reads models/generic/player.bmp, not player.txd, for the default
// player model. A player.bmp in the source folder replaces it.
const bmpPath = join(vc, "models", "generic", "player.bmp");
const bmpFile = join(fromDir, "player.bmp");
const bmpSource = (only.size === 0 || only.has("player")) &&
    await exists(bmpFile)
  ? await Deno.readFile(bmpFile)
  : undefined;

const errors: string[] = [];
const writes: { entry: DirEntry; data: Uint8Array }[] = [];
const img = await Deno.open(imgPath, { read: true, write: true });
try {
  for (const [stem, files] of [...skins].sort()) {
    const given = {
      dff: files.dff ? await Deno.readFile(files.dff) : undefined,
      txd: files.txd ? await Deno.readFile(files.txd) : undefined,
    };
    const present: { dff?: DirEntry[]; txd?: DirEntry[] } = {
      dff: entries.get(`${stem}.dff`),
      txd: entries.get(`${stem}.txd`),
    };
    if (!present.dff && !present.txd) {
      // A new model name. Special characters need no IDE entry, only files.
      if (!files.dff || !files.txd) {
        console.warn(
          `Skipped ${stem}: a new model needs both a .dff and a .txd`,
        );
        continue;
      } else if (stem.length > 7) {
        errors.push(
          `${stem} is a new model with a name over 7 characters, and Vice City script strings hold 7`,
        );
      } else {
        for (const ext of ["dff", "txd"] as const) {
          const added = addEntry(dir, basename(files[ext]!));
          dir = added.dir;
          present[ext] = [added.entry];
        }
      }
    }
    for (const ext of ["dff", "txd"] as const) {
      if (given[ext] && !present[ext]) {
        errors.push(
          `${stem}.${ext} has no entry in gta3.dir. Add both the .dff and the .txd to create a new model.`,
        );
      }
    }
    const dff = given.dff ??
      (present.dff && await readEntry(img, present.dff[0]));
    const txd = given.txd ??
      (present.txd && await readEntry(img, present.txd[0]));
    if (dff && txd) {
      try {
        const have = new Set(txdTextureNames(txd).map((n) => n.toLowerCase()));
        for (const wanted of dffTextureNames(dff)) {
          if (!have.has(wanted.toLowerCase())) {
            errors.push(
              `${stem}.dff asks for texture ${wanted}, and ${stem}.txd has none`,
            );
          }
        }
      } catch (error) {
        errors.push(`Cannot read ${stem}.dff or ${stem}.txd: ${error}`);
      }
    }
    if (given.txd && stem === "player" && !bmpSource) {
      if (await exists(bmpPath)) {
        console.warn(
          "models/generic/player.bmp overrides player.txd for the default player model. Replace that bitmap to change the default skin.",
        );
      }
    }
    for (const ext of ["dff", "txd"] as const) {
      const data = given[ext];
      for (const entry of present[ext] ?? []) {
        if (!data) continue;
        if (sameBytes(await readEntry(img, entry), padToSectors(data))) {
          console.log(`Skipped ${entry.name} (already installed)`);
        } else {
          writes.push({ entry, data });
        }
      }
    }
  }

  if (errors.length > 0) {
    for (const message of errors) console.error(message);
    console.error("Nothing was installed.");
    img.close();
    Deno.exit(1);
  }

  if (dryRun) {
    for (const { entry } of writes) console.log(`Would install ${entry.name}`);
    writes.length = 0;
  }
  if (writes.length > 0 && !await exists(backupPath)) {
    await Deno.writeFile(backupPath, originalBytes);
  }
  for (const { entry, data } of writes) {
    const imgLength = (await img.stat()).size;
    const { padded, offset } = placeEntry(
      dir,
      imgLength,
      entry,
      original[entry.index],
      data,
    );
    await img.seek(offset, Deno.SeekMode.Start);
    await img.write(padded);
    console.log(
      `Installed ${entry.name} (${data.length} bytes) at sector ${
        offset / 2048
      }`,
    );
  }
} finally {
  try {
    img.close();
  } catch {
    // Already closed before the error exit.
  }
}
if (writes.length > 0) {
  await Deno.writeFile(dirPath, dir);
  console.log(`Updated ${dirPath}. Backup: ${backupPath}`);
}
if (bmpSource) {
  const current = await exists(bmpPath) ? await Deno.readFile(bmpPath) : null;
  if (current && sameBytes(current, bmpSource)) {
    console.log("Skipped player.bmp (already installed)");
  } else if (dryRun) {
    console.log("Would install player.bmp");
  } else {
    const bmpBackup = `${bmpPath}.eventide-bak`;
    if (current && !await exists(bmpBackup)) {
      await Deno.writeFile(bmpBackup, current);
    }
    await Deno.writeFile(bmpPath, bmpSource);
    console.log(`Installed player.bmp. Backup: ${bmpBackup}`);
  }
}
