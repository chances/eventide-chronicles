// A thread's recorded statements, compiled to a small instruction list that can be run and compared.
// The input is a node's `outline` from tools/thread-graph. A guard that reads the mission lock gets a
// lock-aware atom; every other guard is a free input that may go either way, and the world is not modeled.
import type {
  GraphNode,
  OutlineBlock,
  OutlineStatement,
} from "../thread-graph/graph.ts";

/**
 * How a guard reads the lock: true when the lock is free, when it is held, and so on. `free` is any other input.
 *
 * The exit atoms read three flags that start false and stay true once set within a run: `died`, `arrested`,
 * and `timerOut`. `wasted` is true when either `died` or `arrested` holds, and it is the atom for
 * `has_deatharrest_been_executed`; `timerOut` is the atom for `$TIMER == 0`. A test of an exit atom whose
 * flag is still false may go either way, and going true sets the flag. `notWasted` and `timerRunning` are the
 * negations.
 */
export type Atom =
  | "unlocked"
  | "locked"
  | "granted"
  | "notGranted"
  | "free"
  | "never"
  | "died"
  | "arrested"
  | "wasted"
  | "notWasted"
  | "timerOut"
  | "timerRunning";

/** Bits of the exit flags a run carries. */
export const DIED = 1;
const ARRESTED = 2;
const TIMER_OUT = 4;

/** The engine's death and arrest guard. */
const DEATH_GUARD = "has_deatharrest_been_executed";
/** The mission countdown variable. */
const TIMER_VAR = "$TIMER";

export type Ins =
  | { op: "eff"; text: string; line?: number }
  | { op: "lock" }
  | { op: "jmp"; to: number }
  | {
    op: "br";
    mode: "and" | "or";
    atoms: Atom[];
    t: number;
    f: number;
    /** Source line of the guard header, and the text of each condition, in atom order. */
    line?: number;
    texts?: string[];
  }
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
    const unique = new Set(
      this.cutRuns(lockFree, bound).map((r) => JSON.stringify(r.effects)),
    );
    return [...unique].sort().map((t) => JSON.parse(t) as string[]);
  }

  /**
   * Every effect trace of up to `bound` visible effects, with the lock free or held for the whole run,
   * and whether the bound cut it off before the script ended. A trace that ends at the bound and also
   * runs on at the bound appears twice, once with each flag.
   */
  cutRuns(
    lockFree: boolean,
    bound: number,
  ): { effects: string[]; cut: boolean }[] {
    return new Runner(this.ins, lockFree).runCuts(bound);
  }

  /**
   * The fewest visible effects needed to reach each ending, with the lock free or held for the whole run.
   * An ending is an instruction where no run can go on: a stop, a return with no caller, or the end of the
   * program. Endings are listed by instruction number.
   */
  endingDepths(lockFree: boolean): { pc: number; depth: number }[] {
    return new Runner(this.ins, lockFree).endingDepths();
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
    const death = t.match(new RegExp(`^(not\\s+)?${DEATH_GUARD}$`));
    if (death) return death[1] ? "notWasted" : "wasted";
    const m = t.match(/^(not\s+)?(\$\w+)(?:\s*(==|!=)\s*(\S+))?$/);
    if (!m) return "free";
    const [, neg, name, op, value] = m;
    if (name === TIMER_VAR && op && value === "0") {
      return (op === "==") !== !!neg ? "timerOut" : "timerRunning";
    }
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

  #branch(
    conditions: string[],
    mode: "single" | "and" | "or",
    line: number,
  ) {
    return this.#emit({
      op: "br" as const,
      mode: mode === "or" ? "or" as const : "and" as const,
      atoms: conditions.map((c) => this.#atom(c)),
      t: -1,
      f: -1,
      line,
      texts: conditions.map(squash),
    });
  }

  #stmts(list: OutlineStatement[]) {
    for (const s of list) this.#stmt(s);
  }

  #stmt(s: OutlineStatement) {
    switch (s.kind) {
      case "if": {
        const s2 = s as Extract<OutlineStatement, { kind: "if" }>;
        const br = this.#branch(s2.conditions, s2.mode, s2.line);
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
        const br = this.#branch(s2.conditions, s2.mode, s2.line);
        // The false branch lands on a jump to the label; the true branch continues after that jump.
        br.f = this.#ins.length;
        this.#emit({ op: "jmp" as const, to: s2.target });
        br.t = this.#ins.length;
        return;
      }
      case "while": {
        const s2 = s as Extract<OutlineStatement, { kind: "while" }>;
        const head = this.#ins.length;
        const br = this.#branch([s2.condition], "single", s2.line);
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
        const br = this.#branch([s2.condition], "single", s2.line);
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
        } else this.#emit({ op: "eff", text: squash(text), line: s.line });
        return;
      }
      case "assignment": {
        const target = text.match(/^(\$\w+)/)?.[1];
        const isLock = target &&
          (this.#config.lockVars.includes(target) ||
            this.#config.grantedVars.includes(target));
        this.#emit(
          isLock
            ? { op: "lock" }
            : { op: "eff", text: squash(text), line: s.line },
        );
        return;
      }
      case "declare_mission_flag":
        this.#emit({ op: "lock" });
        return;
      default:
        this.#emit({ op: "eff", text: squash(text), line: s.line });
    }
  }
}

/** A point in a run: the next instruction, the return stack, the last acquire's result, and the exit flags. */
type RunState = {
  pc: number;
  stack: number[];
  granted: "u" | "t" | "f";
  flags: number;
};

const START: RunState = { pc: 0, stack: [], granted: "u", flags: 0 };
const key = (s: RunState) =>
  `${s.pc}|${s.stack.join(",")}|${s.granted}|${s.flags}`;

/** The values one atom may take, each with the exit flags after the test. */
export function atomOutcomes(
  atom: Atom,
  lockFree: boolean,
  granted: "u" | "t" | "f",
  flags: number,
): { value: boolean; flags: number }[] {
  const sticky = (bit: number, truth: boolean, hold: boolean) =>
    (flags & bit) !== 0
      ? [{ value: hold, flags }]
      : [{ value: truth, flags }, { value: !truth, flags: flags | bit }];
  switch (atom) {
    case "unlocked":
      return [{ value: lockFree, flags }];
    case "locked":
      return [{ value: !lockFree, flags }];
    case "granted":
      return [{ value: granted === "t", flags }];
    case "notGranted":
      return [{ value: granted === "f", flags }];
    case "never":
      return [{ value: false, flags }];
    case "free":
      return [{ value: true, flags }, { value: false, flags }];
    case "died":
      return sticky(DIED, false, true);
    case "arrested":
      return sticky(ARRESTED, false, true);
    case "timerOut":
      return sticky(TIMER_OUT, false, true);
    case "timerRunning":
      return sticky(TIMER_OUT, true, false);
    case "wasted":
      return (flags & (DIED | ARRESTED)) !== 0 ? [{ value: true, flags }] : [
        { value: false, flags },
        { value: true, flags: flags | DIED },
        { value: true, flags: flags | ARRESTED },
      ];
    case "notWasted":
      return (flags & (DIED | ARRESTED)) !== 0 ? [{ value: false, flags }] : [
        { value: true, flags },
        { value: false, flags: flags | DIED },
        { value: false, flags: flags | ARRESTED },
      ];
  }
}

/**
 * Every value a branch may take, with the exit flags after its tests; every condition is tested, with no
 * short-circuit. Outcomes with the same value and flags are listed once, with the first condition values
 * that produce them.
 */
export function branchOutcomes(
  i: Extract<Ins, { op: "br" }>,
  lockFree: boolean,
  granted: "u" | "t" | "f",
  flags: number,
): { value: boolean; flags: number; values: boolean[] }[] {
  let tests: { values: boolean[]; flags: number }[] = [{ values: [], flags }];
  for (const atom of i.atoms) {
    tests = tests.flatMap((test) =>
      atomOutcomes(atom, lockFree, granted, test.flags).map((o) => ({
        values: [...test.values, o.value],
        flags: o.flags,
      }))
    );
  }
  const seen = new Set<string>();
  const out: { value: boolean; flags: number; values: boolean[] }[] = [];
  for (const test of tests) {
    const value = i.mode === "and"
      ? test.values.every((x) => x)
      : test.values.some((x) => x);
    const key = `${value}|${test.flags}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value, flags: test.flags, values: test.values });
  }
  return out;
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
    flags: number,
  ): { value: boolean; flags: number }[] {
    return branchOutcomes(i, this.#lockFree, granted, flags);
  }

  /**
   * Every trace of up to `bound` effects, and whether the bound cut it off before the script ended.
   *
   * The walk starts at the entry and follows the effects forward. At each step it holds the set of run
   * states the trace so far can be in (closed under the moves that show no effect) and groups their
   * next moves by effect, so each distinct trace is visited once and no trace is stored but the
   * result. Memory is the result plus one path of at most `bound` steps, not a set of traces per state.
   */
  runCuts(bound: number): { effects: string[]; cut: boolean }[] {
    type Move = { state: RunState; effect?: string };
    const cache = new Map<string, Move[]>();
    const next = (s: RunState) => {
      const k = key(s);
      let moves = cache.get(k);
      if (!moves) {
        moves = this.#successors(s);
        cache.set(k, moves);
      }
      return moves;
    };
    const close = (seed: RunState[]): RunState[] => {
      const seen = new Map<string, RunState>();
      const stack = [...seed];
      while (stack.length) {
        const s = stack.pop()!;
        const k = key(s);
        if (seen.has(k)) continue;
        seen.set(k, s);
        for (const move of next(s)) {
          if (move.effect === undefined) stack.push(move.state);
        }
      }
      return [...seen.values()];
    };
    const out: { effects: string[]; cut: boolean }[] = [];
    const walk = (subset: RunState[], effects: string[]) => {
      const byEffect = new Map<string, RunState[]>();
      let ends = false;
      for (const s of subset) {
        const moves = next(s);
        if (moves.length === 0) ends = true;
        for (const move of moves) {
          if (move.effect === undefined) continue;
          const targets = byEffect.get(move.effect);
          if (targets) targets.push(move.state);
          else byEffect.set(move.effect, [move.state]);
        }
      }
      if (ends) out.push({ effects: [...effects], cut: false });
      if (effects.length === bound) {
        if (byEffect.size > 0) out.push({ effects: [...effects], cut: true });
        return;
      }
      for (const [effect, targets] of byEffect) {
        effects.push(effect);
        walk(close(targets), effects);
        effects.pop();
      }
    };
    walk(close([START]), []);
    return out.sort((a, b) => {
      const x = JSON.stringify(a.effects);
      const y = JSON.stringify(b.effects);
      return x < y ? -1 : x > y ? 1 : Number(a.cut) - Number(b.cut);
    });
  }

  /**
   * The fewest effects to each ending, found level by level: a level is every state reachable with the
   * same effect count, closed under the moves that show no effect.
   */
  endingDepths(): { pc: number; depth: number }[] {
    const seen = new Set<string>([key(START)]);
    const endings = new Map<number, number>();
    let frontier: RunState[] = [START];
    for (let depth = 0; frontier.length > 0; depth++) {
      const next = new Map<string, RunState>();
      const queue = [...frontier];
      while (queue.length) {
        const s = queue.pop()!;
        const successors = this.#successors(s);
        if (successors.length === 0 && !endings.has(s.pc)) {
          endings.set(s.pc, depth);
        }
        for (const n of successors) {
          const k = key(n.state);
          if (n.effect === undefined) {
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push(n.state);
          } else next.set(k, n.state);
        }
      }
      frontier = [...next].filter(([k]) => !seen.has(k)).map(([k, s]) => {
        seen.add(k);
        return s;
      });
    }
    return [...endings].map(([pc, depth]) => ({ pc, depth })).sort((a, b) =>
      a.pc - b.pc
    );
  }

  #successors(s: RunState) {
    const i = this.#ins[s.pc];
    const next = { ...s, pc: s.pc + 1 };
    type Succ = { state: RunState; effect?: string };
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
            flags: s.flags,
          },
        }] as Succ[];
      case "ret": {
        if (s.stack.length === 0) return [] as Succ[];
        const stack = s.stack.slice(0, -1);
        return [{
          state: { ...s, pc: s.stack[s.stack.length - 1], stack },
        }] as Succ[];
      }
      case "br":
        return this.#outcomes(i, s.granted, s.flags).map((o) => ({
          state: { ...s, pc: o.value ? i.t : i.f, flags: o.flags },
        })) as Succ[];
    }
  }
}
