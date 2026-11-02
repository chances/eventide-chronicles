// Reads and extends the gta3.img archive and its gta3.dir index.

export const SECTOR = 2048;
const ENTRY_SIZE = 32;

export interface DirEntry {
  name: string;
  offset: number;
  size: number;
  index: number;
}

export function listEntries(bytes: Uint8Array): DirEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries: DirEntry[] = [];
  for (let i = 0; i + ENTRY_SIZE <= bytes.length; i += ENTRY_SIZE) {
    entries.push({
      name: decoder.decode(bytes.slice(i + 8, i + ENTRY_SIZE)).replace(
        /\0.*/s,
        "",
      ),
      offset: view.getUint32(i, true) * SECTOR,
      size: view.getUint32(i + 4, true) * SECTOR,
      index: i / ENTRY_SIZE,
    });
  }
  return entries;
}

// Groups entries by lowercase name. A name can appear twice (chef.dff does in
// the stock archive), so every entry with the name is returned.
export function parseDirectory(bytes: Uint8Array): Map<string, DirEntry[]> {
  const byName = new Map<string, DirEntry[]>();
  for (const entry of listEntries(bytes)) {
    const key = entry.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), entry]);
  }
  return byName;
}

export async function readEntry(
  img: Deno.FsFile,
  entry: DirEntry,
): Promise<Uint8Array> {
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

export function padToSectors(data: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil(data.length / SECTOR) * SECTOR);
  padded.set(data);
  return padded;
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

// Adds an empty entry for `name` at the end of the directory. Place data into
// it with placeEntry, passing no original entry.
export function addEntry(
  dir: Uint8Array,
  name: string,
): { dir: Uint8Array; entry: DirEntry } {
  const nameBytes = new TextEncoder().encode(name);
  if (nameBytes.length > 23) {
    throw new Error(`${name} is longer than the 23 characters gta3.dir holds`);
  }
  const longer = new Uint8Array(dir.length + ENTRY_SIZE);
  longer.set(dir);
  longer.set(nameBytes, dir.length + 8);
  return {
    dir: longer,
    entry: { name, offset: 0, size: 0, index: dir.length / ENTRY_SIZE },
  };
}

// Points `entry` at a new copy of `data` and returns the sector-padded bytes
// to write at `offset`. An entry that an earlier install already moved off its
// original location, or that an earlier install added, is reused in place when
// the data still fits. Every other entry is appended after the last byte of
// the image, so the original bytes stay put and restoring the original
// gta3.dir undoes the install. `original` is undefined for an added entry.
export function placeEntry(
  dir: Uint8Array,
  imgLength: number,
  entry: DirEntry,
  original: DirEntry | undefined,
  data: Uint8Array,
): { padded: Uint8Array; offset: number } {
  if (imgLength % SECTOR !== 0) {
    throw new Error("gta3.img length is not a whole number of sectors");
  }
  const padded = padToSectors(data);
  const moved = !original || entry.offset !== original.offset;
  const offset = moved && padded.length <= entry.size
    ? entry.offset
    : imgLength;
  const view = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  view.setUint32(entry.index * ENTRY_SIZE, offset / SECTOR, true);
  view.setUint32(entry.index * ENTRY_SIZE + 4, padded.length / SECTOR, true);
  entry.offset = offset;
  entry.size = padded.length;
  return { padded, offset };
}
