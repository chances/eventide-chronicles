/**
 * @module
 * Derives a mission chart from its source statically.
 */
import {
  type GraphData,
  type GraphNode,
  outlineOf,
  type OutlineStatement,
  SourceProgram,
  ThreadGraph,
} from "@eventide/thread-graph";
import { MarksMerger, type RawStatement, type Statement } from "./marks.ts";
import type { ChartFile } from "./schema.ts";

export type AssemblerOptions = {
  /** Folders, relative to the entry file's folder, that hold streamed CLEO script sources. */
  cleoDirs?: string[];
};

type Access = ChartFile["globals"][number];

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Builds the thread graph of one program once and answers per-mission questions from it. */
export class ChartAssembler {
  readonly #entry: string;
  readonly #wasm: string;
  readonly #cleoDirs: string[];
  #graph?: Promise<GraphData>;
  #source?: Promise<SourceProgram>;

  constructor(entry: string, wasm: string, options: AssemblerOptions = {}) {
    this.#entry = entry;
    this.#wasm = wasm;
    this.#cleoDirs = options.cleoDirs ?? [];
  }

  /**
   * Every global the given mission reads or writes, and every thread or mission that reads or writes one
   * of those globals, as one entry per global, accessor, and access kind.
   */
  async globals(mission: string): Promise<Access[]> {
    const graph = await this.#build();
    const missionNode = this.#find(graph, mission);
    const mine = new Set(missionNode.flags.map((f) => f.var));
    const entries: (Access & { order: number })[] = [];
    graph.nodes.forEach((node, index) => {
      const order = node === missionNode ? -1 : index;
      for (const flag of node.flags) {
        if (flag.access === "declare" || !mine.has(flag.var)) continue;
        entries.push({
          name: flag.var,
          accessor: node.id,
          kind: flag.access,
          order,
        });
      }
    });
    const seen = new Set<string>();
    return entries
      .filter((e) => {
        const key = `${e.name}\0${e.accessor}\0${e.kind}`;
        return seen.has(key) ? false : (seen.add(key), true);
      })
      .sort((a, b) =>
        compare(a.name, b.name) || a.order - b.order ||
        compare(b.kind, a.kind)
      )
      .map(({ name, accessor, kind }) => ({ name, accessor, kind }));
  }

  /**
   * The statements of the mission a mark can sit on, in order of appearance: each leaf statement,
   * and each `if`, `while`, or `repeat` by its header alone.
   */
  async statements(mission: string): Promise<Statement[]> {
    const graph = await this.#build();
    const node = this.#find(graph, mission);
    const program = await this.#program();
    const raw: RawStatement[] = [];
    for (const label of node.labels) {
      for (const { node: stmt, file } of program.blocks.get(label)!.stmts) {
        this.#flatten(outlineOf(stmt), file, raw);
      }
    }
    return MarksMerger.number(raw);
  }

  #flatten(o: OutlineStatement, file: string, out: RawStatement[]) {
    const add = (text: string) => out.push({ text, file, line: o.line });
    if ("then" in o) {
      add(`if ${o.conditions.join(` ${o.mode} `)}`);
      for (const s of o.then) this.#flatten(s, file, out);
      for (const s of o.else ?? []) this.#flatten(s, file, out);
    } else if ("target" in o) {
      add(
        `if ${o.conditions.join(` ${o.mode} `)} goto_if_false @${o.target}`,
      );
    } else if ("body" in o) {
      add(o.kind === "while" ? `while ${o.condition}` : "repeat");
      for (const s of o.body) this.#flatten(s, file, out);
    } else add(o.text);
  }

  #find(graph: GraphData, mission: string): GraphNode {
    const wanted = mission.toLowerCase();
    const found = graph.nodes.find((n) =>
      n.kind === "mission" &&
      (n.id.toLowerCase() === wanted || n.name.toLowerCase() === wanted)
    );
    if (!found) throw new Error(`no mission named ${mission}`);
    return found;
  }

  #program(): Promise<SourceProgram> {
    this.#source ??= SourceProgram.load(this.#entry, this.#wasm);
    return this.#source;
  }

  #build(): Promise<GraphData> {
    this.#graph ??= (async () => {
      const program = await this.#program();
      return new ThreadGraph(this.#entry, this.#wasm, {
        trackedVars: program.globalVars(),
        outline: [],
        cleoDirs: this.#cleoDirs,
      }).build();
    })();
    return this.#graph;
  }
}
