// The fewest visible effects from the start of a state graph to each ending, with the path that reaches it.
import type { Condition, Edge, StateGraph } from "./state-graph.ts";

/** One thing a path does: run an effect, or take one outcome of a guard header. */
export type TraceStep =
  | { readonly kind: "effect"; readonly text: string; readonly line: number }
  | {
    readonly kind: "guard";
    readonly line: number;
    readonly mode: "and" | "or";
    readonly outcome: boolean;
    readonly conditions: readonly Condition[];
  };

/** An ending instruction, its fewest effects, and one path that reaches it with that many. */
export interface EndingPath {
  readonly pc: number;
  readonly depth: number;
  readonly steps: readonly TraceStep[];
}

/**
 * Breadth-first search by effect count: a level is every state reachable with the same number of effects,
 * closed under the moves and guard outcomes that show no effect. Nothing unrolls a loop, because a state is
 * expanded once. Ending states that share an instruction are one ending, at their smallest depth.
 */
export class ShortestPaths {
  readonly #graph: StateGraph;

  constructor(graph: StateGraph) {
    this.#graph = graph;
  }

  /** The endings ordered by instruction number. */
  endings(): EndingPath[] {
    const graph = this.#graph;
    const seen = new Uint8Array(graph.size);
    const parent = new Int32Array(graph.size).fill(-1);
    const via: (Edge | undefined)[] = new Array(graph.size);
    const found = new Map<number, { id: number; depth: number }>();
    seen[graph.start] = 1;
    let frontier = [graph.start];
    for (let depth = 0; frontier.length > 0; depth++) {
      const next = new Map<number, { from: number; edge: Edge }>();
      const queue = [...frontier];
      for (let head = 0; head < queue.length; head++) {
        const id = queue[head];
        const edges = graph.edges(id);
        const pc = graph.state(id).pc;
        if (edges.length === 0 && !found.has(pc)) found.set(pc, { id, depth });
        for (const edge of edges) {
          if (edge.kind === "effect") {
            if (!seen[edge.to] && !next.has(edge.to)) {
              next.set(edge.to, { from: id, edge });
            }
          } else if (!seen[edge.to]) {
            seen[edge.to] = 1;
            parent[edge.to] = id;
            via[edge.to] = edge;
            queue.push(edge.to);
          }
        }
      }
      frontier = [];
      for (const [to, { from, edge }] of next) {
        if (seen[to]) continue;
        seen[to] = 1;
        parent[to] = from;
        via[to] = edge;
        frontier.push(to);
      }
    }
    return [...found].map(([pc, { id, depth }]) => ({
      pc,
      depth,
      steps: this.#trace(id, parent, via),
    })).sort((a, b) => a.pc - b.pc);
  }

  #trace(
    id: number,
    parent: Int32Array,
    via: readonly (Edge | undefined)[],
  ): TraceStep[] {
    const steps: TraceStep[] = [];
    for (let at = id; parent[at] !== -1; at = parent[at]) {
      const edge = via[at]!;
      if (edge.kind === "effect") {
        steps.push({ kind: "effect", text: edge.text, line: edge.line });
      } else if (edge.kind === "guard") {
        steps.push({
          kind: "guard",
          line: edge.line,
          mode: edge.mode,
          outcome: edge.outcome,
          conditions: edge.conditions,
        });
      }
    }
    return steps.reverse();
  }
}
