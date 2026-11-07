/**
 * @module
 * The statement-level control-flow graph of one mission and the state machine marks cut out of it.
 * A state holds every statement reachable by control flow from its mark without crossing
 * another mark. Subroutine (`gosub`) calls are followed. A statement reached from two
 * states is reported.
 *
 * @remarks
 * Waits never split a state. A statement reached through a `gosub` call from two states is an error; one
 * reached only through `gosub` calls is a warning that the subroutine should become a function.
 */
import type { OutlineStatement } from "@eventide/thread-graph";

/** A statement of a mission: its text with whitespace collapsed, and where it is. */
export type RawStatement = { text: string; file: string; line: number };

export type Mode = "single" | "and" | "or";

/** The condition chain a branch tests, and whether the edge is taken when it is false. */
export type GuardSpec = { mode: Mode; conditions: string[]; negated: boolean };

/** A guard written as text, and the conditions the writer had no phrase for. */
export type GuardResult = { text: string; unphrased: string[] };

/** An edge with no `guard` is unconditional. */
export type FlowEdge = { to: number; guard?: GuardSpec; call?: true };
export type FlowItem = RawStatement & { edges: FlowEdge[] };
export type BlockInput = {
  label: string;
  next: string | null;
  stmts: { outline: OutlineStatement; file: string }[];
};

type Laid = {
  id: number;
  o: OutlineStatement;
  then?: Laid[];
  else?: Laid[];
  body?: Laid[];
};

const labelIn = (text: string): string | undefined =>
  text.match(/@([A-Za-z0-9_]+)/)?.[1];

/** The statements of a mission in order of appearance, each with its outgoing control-flow edges. */
export class FlowGraph {
  readonly items: FlowItem[] = [];
  readonly #blocks = new Map<string, BlockInput>();
  readonly #firstOf = new Map<string, number | null>();
  readonly #resolve: (name: string) => string | undefined;

  private constructor(resolve: (name: string) => string | undefined) {
    this.#resolve = resolve;
  }

  static build(
    blocks: BlockInput[],
    resolve: (name: string) => string | undefined,
  ): FlowGraph {
    const graph = new FlowGraph(resolve);
    const laid = blocks.map((b) => {
      graph.#blocks.set(b.label, b);
      const own = b.stmts.map((s) => graph.#lay(s.outline, s.file));
      graph.#firstOf.set(b.label, own[0]?.id ?? null);
      return own;
    });
    blocks.forEach((b, i) => graph.#link(laid[i], graph.#after(b.next), null));
    return graph;
  }

  #lay(o: OutlineStatement, file: string): Laid {
    const text = "then" in o
      ? `if ${o.conditions.join(` ${o.mode} `)}`
      : "target" in o
      ? `if ${o.conditions.join(` ${o.mode} `)} goto_if_false @${o.target}`
      : "body" in o
      ? (o.kind === "while" ? `while ${o.condition}` : "repeat")
      : o.text;
    const laid: Laid = { id: this.items.length, o };
    this.items.push({ text, file, line: o.line, edges: [] });
    if ("then" in o) {
      laid.then = o.then.map((s) => this.#lay(s, file));
      laid.else = o.else?.map((s) => this.#lay(s, file));
    } else if ("body" in o) laid.body = o.body.map((s) => this.#lay(s, file));
    return laid;
  }

  /** The first statement at or after a label, following empty blocks. */
  #after(label: string | null): number | null {
    const seen = new Set<string>();
    while (label !== null && !seen.has(label)) {
      seen.add(label);
      const first = this.#firstOf.get(label);
      if (first !== undefined && first !== null) return first;
      label = this.#blocks.get(label)?.next ?? null;
    }
    return null;
  }

  #target(name: string | undefined): number | null {
    const label = name === undefined ? undefined : this.#resolve(name);
    return label === undefined ? null : this.#after(label);
  }

  #edge(from: number, to: number | null, guard?: GuardSpec, call = false) {
    if (to === null) return;
    this.items[from].edges.push({
      to,
      ...(guard ? { guard } : {}),
      ...(call ? { call: true } : {}),
    });
  }

  /** `after` is where control goes when the list ends, `exit` where a `break` goes. */
  #link(list: Laid[], after: number | null, exit: number | null) {
    list.forEach((laid, i) => {
      const next = i + 1 < list.length ? list[i + 1].id : after;
      const { id, o } = laid;
      if ("then" in o) {
        const yes = laid.then!.length ? laid.then![0].id : next;
        const no = laid.else
          ? (laid.else.length ? laid.else[0].id : next)
          : next;
        const spec = { mode: o.mode, conditions: o.conditions };
        this.#edge(id, yes, { ...spec, negated: false });
        this.#edge(id, no, { ...spec, negated: true });
        this.#link(laid.then!, next, exit);
        this.#link(laid.else ?? [], next, exit);
      } else if ("target" in o) {
        const spec = { mode: o.mode, conditions: o.conditions };
        this.#edge(id, this.#target(o.target), { ...spec, negated: true });
        this.#edge(id, next, { ...spec, negated: false });
      } else if ("body" in o) {
        const first = laid.body!.length ? laid.body![0].id : id;
        const spec = {
          mode: "single" as const,
          conditions: [o.condition],
        };
        if (o.kind === "while") {
          this.#edge(id, first, { ...spec, negated: false });
          if (o.condition !== "true") {
            this.#edge(id, next, { ...spec, negated: true });
          }
        } else {
          this.#edge(id, first);
          this.#edge(id, next, { ...spec, negated: false });
        }
        this.#link(laid.body!, id, next);
      } else {
        switch (o.kind) {
          case "goto_statement":
            this.#edge(id, this.#target(labelIn(o.text)));
            break;
          case "gosub_statement":
            this.#edge(id, this.#target(labelIn(o.text)), undefined, true);
            this.#edge(id, next);
            break;
          case "break_statement":
            this.#edge(id, exit);
            break;
          case "terminate_script":
          case "return_statement":
            break;
          default:
            this.#edge(id, next);
        }
      }
    });
  }
}

export type StateTransition = { guard: string; target: string };
export type DerivedState = { label?: string; transitions: StateTransition[] };
export type StateIssue =
  | {
    kind: "reach";
    file: string;
    line: number;
    severity: "error" | "warning";
    states: string[];
  }
  | { kind: "unphrased"; severity: "error" | "warning"; expression: string };

export type StateOutput = { states: DerivedState[]; errors: StateIssue[] };

/**
 * Cuts the graph into states. Each mark begins a state at `item`; an unlabeled start state begins at
 * the first statement unless a mark sits there. A transition is a control-flow edge that reaches
 * another state's first statement, and `target` is that state's label, else `State N` from 1.
 */
export function deriveStates(
  graph: FlowGraph,
  marks: { item: number; label?: string }[],
  writeGuard: (guard: GuardSpec) => GuardResult,
): StateOutput {
  const unphrased = new Set<string>();
  const starts = [...new Map(marks.map((m) => [m.item, m])).values()]
    .sort((a, b) => a.item - b.item);
  if (graph.items.length && starts[0]?.item !== 0) {
    starts.unshift({ item: 0 });
  }
  const names = starts.map((s, i) => s.label ?? `State ${i + 1}`);
  const startOf = new Map(starts.map((s, i) => [s.item, i]));
  const direct: Set<number>[] = [];
  const any: Set<number>[] = [];
  const out = starts.map((start, s) => {
    const seen = new Set<string>();
    const reached = new Set<number>();
    const viaDirect = new Set<number>();
    const queue: [number, boolean][] = [[start.item, false]];
    const found = new Map<string, { guard: string; target: number }>();
    while (queue.length) {
      const [item, called] = queue.shift()!;
      const key = `${item}:${called}`;
      if (seen.has(key)) continue;
      seen.add(key);
      reached.add(item);
      if (!called) viaDirect.add(item);
      for (const e of graph.items[item].edges) {
        const mark = startOf.get(e.to);
        if (mark !== undefined) {
          const written = e.guard ? writeGuard(e.guard) : undefined;
          written?.unphrased.forEach((x) => unphrased.add(x));
          const guard = written?.text ?? "";
          found.set(`${guard}\0${mark}`, { guard, target: mark });
        } else queue.push([e.to, called || e.call === true]);
      }
    }
    any[s] = reached;
    direct[s] = viaDirect;
    const transitions = [...found.values()]
      .sort((a, b) => a.target - b.target || (a.guard < b.guard ? -1 : 1))
      .map((t) => ({ guard: t.guard, target: names[t.target] }));
    return {
      ...(start.label === undefined ? {} : { label: start.label }),
      transitions,
    };
  });
  const errors: StateOutput["errors"] = [];
  graph.items.forEach((item, i) => {
    const by = starts.flatMap((_, s) => any[s].has(i) ? [s] : []);
    if (by.length < 2) return;
    const severity = by.every((s) => !direct[s].has(i)) ? "warning" : "error";
    errors.push({
      kind: "reach",
      file: item.file,
      line: item.line,
      severity,
      states: by.map((s) => names[s]),
    });
  });
  for (const expression of [...unphrased].sort()) {
    errors.push({ kind: "unphrased", severity: "error", expression });
  }
  return { states: out, errors };
}
