// A thread's behavior as a finite graph, built by a worklist with no recursion and no trace listing.
// A state is the next instruction, the return stack, the last acquire result, and the exit flags. An edge
// carries one visible effect, one guard outcome, or nothing (a jump, call, return, or lock move). A state
// with no edge is an ending.
import type { GraphNode } from "../thread-graph/graph.ts";
import {
  branchOutcomes,
  DIED,
  FlowProgram,
  type Ins,
  type LockConfig,
} from "./program.ts";

/** A resource limit stopped the build. The message names the cap that fired. */
export class GraphLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphLimitError";
  }
}

/** One thread compiled to one instruction list; each instruction carries its source line and guard text. */
export class ThreadProgram {
  readonly ins: readonly Ins[];
  readonly entry: string;

  private constructor(ins: readonly Ins[], entry: string) {
    this.ins = ins;
    this.entry = entry;
  }

  static compile(node: GraphNode, config: LockConfig): ThreadProgram {
    const flow = FlowProgram.compile(node, config);
    return new ThreadProgram(flow.ins, flow.entry);
  }

  /** @internal A program from instructions written by hand, for tests. */
  static of(ins: readonly Ins[], entry: string): ThreadProgram {
    return new ThreadProgram(ins, entry);
  }
}

/** The acquire result: unknown, granted, or refused. */
export type Granted = "u" | "t" | "f";

/** A point in a run. */
export interface GraphState {
  readonly pc: number;
  readonly stack: readonly number[];
  readonly granted: Granted;
  readonly flags: number;
}

/** One condition of a guard header and the value it took on an edge. */
export interface Condition {
  readonly text: string;
  readonly value: boolean;
}

export type Edge =
  | {
    readonly kind: "effect";
    readonly to: number;
    readonly text: string;
    readonly line: number;
  }
  | {
    readonly kind: "guard";
    readonly to: number;
    readonly line: number;
    readonly mode: "and" | "or";
    /** The result of the header: the and or the or of every condition. */
    readonly outcome: boolean;
    readonly conditions: readonly Condition[];
  }
  | { readonly kind: "move"; readonly to: number };

export interface GraphOptions {
  /** The mission lock is free for the whole run, or held for the whole run. */
  readonly lockFree: boolean;
  /**
   * The engine resumes a mission script on death: every state inside the first call gets a no-effect edge to
   * the instruction after that call, with the died flag set.
   */
  readonly resumeOnDeath?: boolean;
  /** The deepest return stack allowed. */
  readonly callCap?: number;
  /** The most states allowed. */
  readonly stateCap?: number;
}

const DEFAULT_CALL_CAP = 16;
const DEFAULT_STATE_CAP = 2_000_000;

/**
 * The graph of one thread with the lock free or held.
 *
 * @remarks Two states are the same when the instruction, return stack, acquire result, and exit flags are
 * equal; the path that reached a state is not part of it. Every condition of a multi-condition header is
 * read, and outcomes with the same result and flags are one edge that keeps the first condition values
 * producing it. The start state is 0.
 */
export class StateGraph {
  readonly start = 0;
  readonly #states: GraphState[] = [];
  readonly #edges: Edge[][] = [];

  private constructor() {}

  static build(program: ThreadProgram, options: GraphOptions): StateGraph {
    const graph = new StateGraph();
    graph.#expand(program, options);
    return graph;
  }

  get size(): number {
    return this.#states.length;
  }

  state(id: number): GraphState {
    return this.#states[id];
  }

  edges(id: number): readonly Edge[] {
    return this.#edges[id];
  }

  /** The states with no edge, in id order. */
  endings(): number[] {
    const ids: number[] = [];
    this.#edges.forEach((edges, id) => {
      if (edges.length === 0) ids.push(id);
    });
    return ids;
  }

  #expand(program: ThreadProgram, options: GraphOptions): void {
    const callCap = options.callCap ?? DEFAULT_CALL_CAP;
    const stateCap = options.stateCap ?? DEFAULT_STATE_CAP;
    const ids = new Map<string, number>();
    const work: number[] = [];
    const intern = (state: GraphState): number => {
      const key = `${state.pc}|${
        state.stack.join(",")
      }|${state.granted}|${state.flags}`;
      const known = ids.get(key);
      if (known !== undefined) return known;
      if (this.#states.length >= stateCap) {
        throw new GraphLimitError(`state cap ${stateCap} reached`);
      }
      const id = this.#states.length;
      ids.set(key, id);
      this.#states.push(state);
      this.#edges.push([]);
      work.push(id);
      return id;
    };
    intern({ pc: 0, stack: [], granted: "u", flags: 0 });
    while (work.length > 0) {
      const id = work.pop()!;
      const s = this.#states[id];
      const edges = this.#edges[id];
      const ins = program.ins[s.pc];
      const next = { ...s, pc: s.pc + 1 };
      if (!ins || ins.op === "stop") continue;
      if (options.resumeOnDeath && s.stack.length >= 1) {
        edges.push({
          kind: "move",
          to: intern({
            pc: s.stack[0],
            stack: [],
            granted: s.granted,
            flags: s.flags | DIED,
          }),
        });
      }
      switch (ins.op) {
        case "eff":
          edges.push({
            kind: "effect",
            to: intern(next),
            text: ins.text,
            line: ins.line ?? 0,
          });
          break;
        case "lock":
          edges.push({ kind: "move", to: intern(next) });
          break;
        case "jmp":
          edges.push({ kind: "move", to: intern({ ...s, pc: ins.to }) });
          break;
        case "acq":
          edges.push({
            kind: "move",
            to: intern({ ...next, granted: options.lockFree ? "t" : "f" }),
          });
          break;
        case "call":
          if (s.stack.length + 1 > callCap) {
            throw new GraphLimitError(`call cap ${callCap} reached`);
          }
          edges.push({
            kind: "move",
            to: intern({ ...s, pc: ins.to, stack: [...s.stack, s.pc + 1] }),
          });
          break;
        case "ret":
          if (s.stack.length === 0) break;
          edges.push({
            kind: "move",
            to: intern({
              ...s,
              pc: s.stack[s.stack.length - 1],
              stack: s.stack.slice(0, -1),
            }),
          });
          break;
        case "br":
          for (
            const o of branchOutcomes(ins, options.lockFree, s.granted, s.flags)
          ) {
            edges.push({
              kind: "guard",
              to: intern({ ...s, pc: o.value ? ins.t : ins.f, flags: o.flags }),
              line: ins.line ?? 0,
              mode: ins.mode,
              outcome: o.value,
              conditions: o.values.map((value, i) => ({
                text: ins.texts?.[i] ?? ins.atoms[i],
                value,
              })),
            });
          }
          break;
      }
    }
  }
}
