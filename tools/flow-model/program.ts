// A thread's recorded statements, compiled to a small instruction list that can be run and compared.
// The input is a node's `outline` from tools/thread-graph. A guard that reads the mission lock gets a
// lock-aware atom; every other guard is a free input that may go either way, and the world is not modeled.
import type {
  GraphNode,
  OutlineBlock,
  OutlineStatement,
} from "../thread-graph/graph.ts";

/** How a guard reads the lock: true when the lock is free, when it is held, and so on. `free` is any other input. */
export type Atom =
  | "unlocked"
  | "locked"
  | "granted"
  | "notGranted"
  | "free"
  | "never";

export type Ins =
  | { op: "eff"; text: string }
  | { op: "lock" }
  | { op: "jmp"; to: number }
  | { op: "br"; mode: "and" | "or"; atoms: Atom[]; t: number; f: number }
  | { op: "acq" }
  | { op: "call"; to: number }
  | { op: "ret" }
  | { op: "stop" };

export type LockConfig = {
  /** Variables that hold the lock; a nonzero value means held. */
  lockVars: string[];
  /** Variables that report whether the last acquire was granted. */
  grantedVars: string[];
  /** Identifiers that are always false, such as `DebugTrace`. */
  neverTrue: string[];
  /** The subroutine whose `gosub` is an acquire. */
  acquireLabel: string;
};

type Pending = Ins | { op: "jmp" | "call"; to: string };

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** One thread compiled from an outline. */
export class FlowProgram {
  readonly ins: Ins[];
  readonly entry: string;

  private constructor(ins: Ins[], entry: string) {
    this.ins = ins;
    this.entry = entry;
  }

  static compile(node: GraphNode, config: LockConfig): FlowProgram {
    if (!node.outline) throw new Error(`${node.id} has no outline`);
    return new Compiler(node.outline, config).compile(node.id);
  }

  /** @internal */
  static of(ins: Ins[], entry: string): FlowProgram {
    return new FlowProgram(ins, entry);
  }

  /** Every effect trace of up to `bound` visible effects, with the lock free or held for the whole run. */
  runs(lockFree: boolean, bound: number): string[][] {
    return new Runner(this.ins, lockFree).run(bound);
  }
}

class Compiler {
  readonly #blocks: OutlineBlock[];
  readonly #config: LockConfig;
  readonly #byLower = new Map<string, string>();
  readonly #ins: Pending[] = [];
  readonly #labelAt = new Map<string, number>();
  #loops: { exits: Pending[] }[] = [];

  constructor(blocks: OutlineBlock[], config: LockConfig) {
    this.#blocks = blocks;
    this.#config = config;
    for (const b of blocks) this.#byLower.set(b.label.toLowerCase(), b.label);
  }

  compile(entry: string): FlowProgram {
    for (const block of this.#blocks) {
      this.#labelAt.set(block.label, this.#ins.length);
      for (const s of block.statements) this.#stmt(s);
    }
    const end = this.#ins.length;
    this.#ins.push({ op: "stop" });
    const resolve = (label: string): number => {
      const canonical = this.#byLower.get(label.toLowerCase());
      return canonical === undefined ? end : this.#labelAt.get(canonical)!;
    };
    const ins = this.#ins.map((i): Ins =>
      (i.op === "jmp" || i.op === "call") && typeof i.to === "string"
        ? { op: i.op, to: resolve(i.to) }
        : i as Ins
    );
    return FlowProgram.of(ins, entry);
  }

  #emit<T extends Pending>(i: T): T {
    this.#ins.push(i);
    return i;
  }

  #atom(text: string): Atom {
    const t = squash(text);
    if (this.#config.neverTrue.includes(t)) return "never";
    const m = t.match(/^(not\s+)?(\$\w+)(?:\s*(==|!=)\s*(\S+))?$/);
    if (!m) return "free";
    const [, neg, name, op, value] = m;
    const lock = this.#config.lockVars.includes(name);
    const granted = this.#config.grantedVars.includes(name);
    if (!lock && !granted) return "free";
    let positive = true;
    if (op) {
      const truthy = !/^(0|false)$/i.test(value);
      positive = op === "==" ? truthy : !truthy;
    }
    if (neg) positive = !positive;
    if (lock) return positive ? "locked" : "unlocked";
    return positive ? "granted" : "notGranted";
  }

  #branch(conditions: string[], mode: "single" | "and" | "or") {
    return this.#emit({
      op: "br" as const,
      mode: mode === "or" ? "or" as const : "and" as const,
      atoms: conditions.map((c) => this.#atom(c)),
      t: -1,
      f: -1,
    });
  }

  #stmts(list: OutlineStatement[]) {
    for (const s of list) this.#stmt(s);
  }

  #stmt(s: OutlineStatement) {
    switch (s.kind) {
      case "if": {
        const s2 = s as Extract<OutlineStatement, { kind: "if" }>;
        const br = this.#branch(s2.conditions, s2.mode);
        br.t = this.#ins.length;
        this.#stmts(s2.then);
        if (s2.else) {
          const jump = this.#emit({ op: "jmp" as const, to: -1 });
          br.f = this.#ins.length;
          this.#stmts(s2.else);
          jump.to = this.#ins.length;
        } else br.f = this.#ins.length;
        return;
      }
      case "if_goto": {
        const s2 = s as Extract<OutlineStatement, { kind: "if_goto" }>;
        const br = this.#branch(s2.conditions, s2.mode);
        // The false branch lands on a jump to the label; the true branch continues after that jump.
        br.f = this.#ins.length;
        this.#emit({ op: "jmp" as const, to: s2.target });
        br.t = this.#ins.length;
        return;
      }
      case "while": {
        const s2 = s as Extract<OutlineStatement, { kind: "while" }>;
        const head = this.#ins.length;
        const br = this.#branch([s2.condition], "single");
        br.t = this.#ins.length;
        this.#loops.push({ exits: [] });
        this.#stmts(s2.body);
        this.#emit({ op: "jmp" as const, to: head });
        br.f = this.#ins.length;
        const loop = this.#loops.pop()!;
        for (const e of loop.exits) (e as { to: number }).to = this.#ins.length;
        return;
      }
      case "repeat": {
        const s2 = s as Extract<OutlineStatement, { kind: "repeat" }>;
        const head = this.#ins.length;
        this.#loops.push({ exits: [] });
        this.#stmts(s2.body);
        const br = this.#branch([s2.condition], "single");
        br.f = head;
        br.t = this.#ins.length;
        const loop = this.#loops.pop()!;
        for (const e of loop.exits) (e as { to: number }).to = this.#ins.length;
        return;
      }
    }
    const text = (s as { text: string }).text;
    switch (s.kind) {
      case "goto_statement":
        this.#emit({ op: "jmp", to: text.replace(/^goto\s+@/i, "") });
        return;
      case "gosub_statement": {
        const label = text.replace(/^gosub\s+@/i, "");
        if (label.toLowerCase() === this.#config.acquireLabel.toLowerCase()) {
          this.#emit({ op: "acq" });
        } else this.#emit({ op: "call", to: label });
        return;
      }
      case "return_statement":
        this.#emit({ op: "ret" });
        return;
      case "terminate_script":
        this.#emit({ op: "stop" });
        return;
      case "break_statement": {
        const jump = this.#emit({ op: "jmp" as const, to: -1 });
        this.#loops[this.#loops.length - 1]?.exits.push(jump);
        return;
      }
      case "function_call": {
        const m = text.match(/^(\w+)\(\)$/);
        if (m && this.#byLower.has(m[1].toLowerCase())) {
          this.#emit({ op: "call", to: m[1] });
        } else this.#emit({ op: "eff", text: squash(text) });
        return;
      }
      case "assignment": {
        const target = text.match(/^(\$\w+)/)?.[1];
        const isLock = target &&
          (this.#config.lockVars.includes(target) ||
            this.#config.grantedVars.includes(target));
        this.#emit(isLock ? { op: "lock" } : { op: "eff", text: squash(text) });
        return;
      }
      case "declare_mission_flag":
        this.#emit({ op: "lock" });
        return;
      default:
        this.#emit({ op: "eff", text: squash(text) });
    }
  }
}

/** Bounded run of a program with the lock free or held for the whole run. */
class Runner {
  readonly #ins: Ins[];
  readonly #lockFree: boolean;

  constructor(ins: Ins[], lockFree: boolean) {
    this.#ins = ins;
    this.#lockFree = lockFree;
  }

  #outcomes(
    i: Extract<Ins, { op: "br" }>,
    granted: "u" | "t" | "f",
  ): boolean[] {
    let free = false;
    const fixed: boolean[] = [];
    for (const a of i.atoms) {
      switch (a) {
        case "unlocked":
          fixed.push(this.#lockFree);
          break;
        case "locked":
          fixed.push(!this.#lockFree);
          break;
        case "granted":
          fixed.push(granted === "t");
          break;
        case "notGranted":
          fixed.push(granted === "f");
          break;
        case "never":
          fixed.push(false);
          break;
        case "free":
          free = true;
          break;
      }
    }
    if (i.mode === "and") {
      const base = fixed.every((x) => x);
      return free ? (base ? [true, false] : [false]) : [base];
    }
    const base = fixed.some((x) => x);
    if (i.atoms.length === 0) return [false];
    return free ? (base ? [true] : [true, false]) : [base];
  }

  /** All traces of up to `bound` effects, found level by level until each level stops growing. */
  run(bound: number): string[][] {
    type State = { pc: number; stack: number[]; granted: "u" | "t" | "f" };
    const key = (s: State) => `${s.pc}|${s.stack.join(",")}|${s.granted}`;
    const states = new Map<string, State>();
    const queue: State[] = [{ pc: 0, stack: [], granted: "u" }];
    // Reachable states, ignoring the effect budget.
    while (queue.length) {
      const s = queue.pop()!;
      const k = key(s);
      if (states.has(k)) continue;
      states.set(k, s);
      for (const n of this.#successors(s)) queue.push(n.state);
    }
    let previous = new Map<string, Set<string>>();
    for (const k of states.keys()) {
      previous.set(k, new Set([JSON.stringify([])]));
    }
    for (let level = 1; level <= bound; level++) {
      const current = new Map<string, Set<string>>();
      for (const k of states.keys()) current.set(k, new Set());
      let changed = true;
      while (changed) {
        changed = false;
        for (const [k, s] of states) {
          const out = current.get(k)!;
          const before = out.size;
          const successors = this.#successors(s);
          if (successors.length === 0) out.add(JSON.stringify([]));
          for (const n of successors) {
            if (n.effect === undefined) {
              for (const t of current.get(key(n.state))!) {
                out.add(t);
              }
            } else {
              for (const t of previous.get(key(n.state))!) {
                out.add(JSON.stringify([n.effect, ...JSON.parse(t)]));
              }
            }
          }
          if (out.size !== before) changed = true;
        }
      }
      previous = current;
    }
    const init = key({ pc: 0, stack: [], granted: "u" });
    return [...previous.get(init)!].map((t) => JSON.parse(t) as string[]).sort((
      a,
      b,
    ) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
  }

  #successors(s: { pc: number; stack: number[]; granted: "u" | "t" | "f" }) {
    const i = this.#ins[s.pc];
    const next = { ...s, pc: s.pc + 1 };
    type Succ = { state: typeof s; effect?: string };
    if (!i || i.op === "stop") return [] as Succ[];
    switch (i.op) {
      case "eff":
        return [{ state: next, effect: i.text }] as Succ[];
      case "lock":
        return [{ state: next }] as Succ[];
      case "jmp":
        return [{ state: { ...s, pc: i.to } }] as Succ[];
      case "acq":
        return [{
          state: { ...next, granted: this.#lockFree ? "t" : "f" },
        }] as Succ[];
      case "call":
        return [{
          state: {
            pc: i.to,
            stack: [...s.stack, s.pc + 1],
            granted: s.granted,
          },
        }] as Succ[];
      case "ret": {
        if (s.stack.length === 0) return [] as Succ[];
        const stack = s.stack.slice(0, -1);
        return [{
          state: { pc: s.stack[s.stack.length - 1], stack, granted: s.granted },
        }] as Succ[];
      }
      case "br":
        return this.#outcomes(i, s.granted).map((o) => ({
          state: { ...s, pc: o ? i.t : i.f },
        })) as Succ[];
    }
  }
}
