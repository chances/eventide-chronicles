/**
 * Reads Vice City GXT text tables.
 *
 * @remarks The file starts with a `TABL` header of 12-byte entries (8-byte table name, dword offset).
 * `MAIN` has its `TKEY` block at its offset with no name prefix. Other blocks start with an 8-byte table name.
 * TKEY entries are 12 bytes: a dword TDAT offset, then an 8-byte key, NUL-padded. Keys are read as written, with no hash.
 * TDAT strings are NUL-terminated UTF-16LE, and each offset counts from the TDAT marker plus 8.
 */

export class GxtReader {
  #bytes: Uint8Array;
  #view: DataView;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  #tag(at: number): string {
    return this.#ascii(at, 4);
  }

  #u32(at: number): number {
    return this.#view.getUint32(at, true);
  }

  #ascii(at: number, length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      const code = this.#bytes[at + i];
      if (code === 0) break;
      out += String.fromCharCode(code);
    }
    return out;
  }

  #utf16(at: number): string {
    let out = "";
    for (let p = at; p + 1 < this.#bytes.length; p += 2) {
      const unit = this.#view.getUint16(p, true);
      if (unit === 0) break;
      out += String.fromCharCode(unit);
    }
    return out;
  }

  tables(): { name: string; offset: number }[] {
    if (this.#tag(0) !== "TABL") throw new Error("missing TABL header");
    const count = this.#u32(4) / 12;
    const list = [];
    for (let i = 0; i < count; i++) {
      const at = 8 + i * 12;
      list.push({ name: this.#ascii(at, 8), offset: this.#u32(at + 8) });
    }
    return list;
  }

  entries(table: { name: string; offset: number }): { key: string; text: string }[] {
    // MAIN starts with TKEY at its offset; other blocks carry an 8-byte name first.
    const marker = this.#tag(table.offset) === "TKEY" ? table.offset : table.offset + 8;
    if (this.#tag(marker) !== "TKEY") throw new Error(`no TKEY block for ${table.name}`);
    const size = this.#u32(marker + 4);
    const first = marker + 8;
    const tdat = first + size;
    if (this.#tag(tdat) !== "TDAT") throw new Error(`no TDAT block after ${table.name}`);
    const base = tdat + 8;
    const list = [];
    for (let i = 0; i < size / 12; i++) {
      const at = first + i * 12;
      list.push({ key: this.#ascii(at + 4, 8), text: this.#utf16(base + this.#u32(at)) });
    }
    return list;
  }
}

