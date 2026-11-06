// Control-flow graph of a Sanny Builder script, from any label.
// ControlFlow.load resolves {$INCLUDE path} lines against the script's folder and
// builds a block per label. reachable(label) returns the blocks reachable from a
// label. Reachability follows goto, goto_if_false, calls, fall-through, and
// start_new_script; Mission.LoadAndLaunchInternal is recorded but not followed.
import { dirname, join } from "@std/path";

type Entry = { file: string; line: number; text: string };

export type Edge = { kind: string; to: string; returns?: boolean };

export type Block = {
  label: string;
  at: string;
  flag: string[];
  launch: string[];
  starts: string[];
  yields: boolean;
  term: string | null;
  edges: Edge[];
};

type Frame = {
  hasElse: boolean;
  thenT: boolean;
  elseT: boolean;
  inElse: boolean;
  loop: boolean;
};

export class ControlFlow {
  #blocks = new Map<string, Block>();
  #order: string[] = [];

  private constructor(entries: Entry[]) {
    this.#parse(entries);
  }

  /** Read a script and its includes, then build the blocks. */
  static async load(scriptPath: string): Promise<ControlFlow> {
    const root = dirname(scriptPath);
    const entries: Entry[] = [];
    async function read(path: string) {
      const text = new TextDecoder("windows-1252").decode(
        await Deno.readFile(path),
      );
      const rows = text.split(/\r?\n/);
      for (let n = 0; n < rows.length; n++) {
        const inc = rows[n].match(/^\s*\{\$INCLUDE\s+(.+?)\s*\}/i);
        if (inc) {
          const target = join(root, inc[1]);
          try {
            await read(target);
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
            console.error(
              `warning: ${path}:${n + 1} includes missing file ${target}`,
            );
          }
        } else entries.push({ file: path, line: n + 1, text: rows[n] });
      }
    }
    await read(scriptPath);
    return new ControlFlow(entries);
  }

  has(label: string): boolean {
    return this.#blocks.has(label);
  }

  /** Blocks reachable from a label, in source order. Throws when the label is absent. */
  reachable(startLabel: string): Block[] {
    if (!this.#blocks.has(startLabel)) {
      throw new Error(`label not found: ${startLabel}`);
    }
    const reach = new Set<string>();
    const queue = [startLabel];
    while (queue.length) {
      const l = queue.shift()!;
      const b = this.#blocks.get(l);
      if (reach.has(l) || !b) continue;
      reach.add(l);
      for (const e of b.edges) queue.push(e.to);
      for (const s of b.starts) queue.push(s);
    }
    return this.#order.filter((l) => reach.has(l)).map((l) =>
      this.#blocks.get(l)!
    );
  }

  #parse(entries: Entry[]) {
    const blocks = this.#blocks;
    const order = this.#order;
    const lines = entries.map((e) => e.text);
    const at = (i: number) => `${entries[i].file}:${entries[i].line}`;
    const start = 0;
    const end = lines.length;

    let cur: Block | null = null;
    let stack: Frame[] = [];
    let rootT = false;
    let pendingIf = false;
    let pendingLoop = false;

    const labels = new Set<string>();
    for (let i = start; i < end; i++) {
      const m = lines[i].match(/^:(\w+)/);
      if (m) labels.add(m[1]);
    }

    const setTerm = (kind: string) => {
      if (!cur) return;
      const top = stack[stack.length - 1];
      if (!top) {
        rootT = true;
        cur.term = cur.term ?? kind;
      } else if (top.inElse) top.elseT = true;
      else top.thenT = true;
    };
    const isTerm = (): boolean => {
      const top = stack[stack.length - 1];
      return top ? (top.inElse ? top.elseT : top.thenT) : rootT;
    };
    const closeBlock = (next: string | null) => {
      if (!cur) return;
      if (!rootT && next) cur.edges.push({ kind: "fall", to: next });
    };

    for (let i = start; i < end; i++) {
      const raw = lines[i];
      const t = raw.replace(/\/\/.*$/, "").trim();
      if (!t) continue;
      const lm = t.match(/^:(\w+)/);
      if (lm) {
        closeBlock(lm[1]);
        cur = {
          label: lm[1],
          at: at(i),
          flag: [],
          launch: [],
          starts: [],
          yields: false,
          term: null,
          edges: [],
        };
        blocks.set(cur.label, cur);
        order.push(cur.label);
        stack = [];
        rootT = false;
        pendingIf = false;
        continue;
      }
      if (!cur || isTerm()) {
        if (/^(end|else)\b/.test(t) === false) continue;
      }
      const block = cur as Block;
      if (/^if\b/.test(t)) {
        pendingIf = true;
        continue;
      }
      if (/^while\b/.test(t)) {
        pendingLoop = true;
        continue;
      }
      if (/^then\b/.test(t)) {
        stack.push({
          hasElse: false,
          thenT: false,
          elseT: false,
          inElse: false,
          loop: false,
        });
        pendingIf = false;
        continue;
      }
      if (
        pendingLoop && !/^then\b/.test(t) && stack.length >= 0 &&
        /^(wait|if|\$|Text|Player|Camera)/.test(t) && !pendingIf
      ) {
        stack.push({
          hasElse: false,
          thenT: false,
          elseT: false,
          inElse: false,
          loop: true,
        });
        pendingLoop = false;
      }
      if (/^else\b/.test(t)) {
        const top = stack[stack.length - 1];
        if (top) {
          top.hasElse = true;
          top.inElse = true;
        }
        continue;
      }
      if (/^end\b/.test(t)) {
        const f = stack.pop();
        if (f) {
          const closed = !f.loop && f.hasElse && f.thenT && f.elseT;
          if (closed) {
            const top = stack[stack.length - 1];
            if (!top) rootT = true;
            else if (top.inElse) top.elseT = true;
            else top.thenT = true;
          }
        }
        continue;
      }
      let m;
      if ((m = t.match(/^goto_if_false\s+@(\w+)/))) {
        block.edges.push({ kind: "if-false", to: m[1] });
        pendingIf = false;
        continue;
      }
      if ((m = t.match(/^goto\s+@(\w+)/))) {
        block.edges.push({ kind: "goto", to: m[1] });
        setTerm("goto");
        continue;
      }
      if (/^terminate_this_script/.test(t)) {
        setTerm("terminate");
        continue;
      }
      if (/^return\b/.test(t)) {
        setTerm("return");
        continue;
      }
      if (/^wait\b/.test(t)) block.yields = true;
      if ((m = t.match(/^\$ONMISSION\s*=\s*(\w+)/))) {
        block.flag.push(`${m[1]}@${at(i)}`);
      }
      if ((m = t.match(/Mission\.LoadAndLaunchInternal\((\d+)\)/))) {
        block.launch.push(`${m[1]}@${at(i)}`);
      }
      if ((m = t.match(/^start_new_script\s+@(\w+)/))) block.starts.push(m[1]);
      if (/has_deatharrest_been_executed/.test(t)) {
        block.flag.push(`deathcheck@${at(i)}`);
      }
      if ((m = t.match(/^(\w+)\(\)$/)) && labels.has(m[1])) {
        block.edges.push({ kind: "call", to: m[1] });
      }
    }

    /** Determine whether a callee reaches `return`. */
    const reachesReturn = (from: string, seen = new Set<string>()): boolean => {
      if (seen.has(from)) return false;
      seen.add(from);
      const b = blocks.get(from);
      if (!b) return false;
      if (b.term === "return") return true;
      return b.edges.some((e) =>
        e.kind !== "call" && reachesReturn(e.to, seen)
      );
    };
    for (const b of blocks.values()) {
      for (const e of b.edges) {
        if (e.kind === "call") e.returns = reachesReturn(e.to);
      }
    }
  }
}
