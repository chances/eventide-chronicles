/**
 * @module
 * Derives a mission chart from its source statically.
 *
 * @remarks
 * No recorded game run feeds the chart. Trigger traces run at bound 12 and mission-script traces at bound 24,
 * each trace stores its own bound, and a trace that hit its bound carries `cut: true`. The conflict thread
 * side is `MAIN`, CLEO scripts, and thread-kind scripts; every script of kind `mission` is skipped because
 * the engine runs one mission at a time. A `trigger-mission` conflict is listed on the chart of every
 * mission, whichever mission the trigger launches.
 */
import {
  type GraphData,
  type GraphNode,
  outlineOf,
  type OutlineStatement,
  SourceProgram,
  ThreadGraph,
} from "@eventide/thread-graph";
import { candidateLock, FlowProgram } from "@eventide/flow-model";
import {
  type Mark,
  MarksMerger,
  type RawStatement,
  type Statement,
} from "./marks.ts";
import type { ChartFile } from "./schema.ts";
import { deriveStates, FlowGraph, type StateOutput } from "@eventide/cfg";
import { GuardWriter, loadLibrary, Phrasebook } from "./guards.ts";

export type AssemblerOptions = {
  /** Path of the Phrasebook CSV; without it every guard condition is unphrased. */
  phrasebook?: string;
  /** Path of the Sanny Builder library JSON, such as `vc.json`, that names the arguments of class commands. */
  library?: string;
  /** First and last mission number whose unguarded launches are trigger-mission conflicts; default 1 to 6. */
  missionRange?: [number, number];
  /** Folders, relative to the entry file's folder, that hold streamed CLEO script sources. */
  cleoDirs?: string[];
  /** Effects per run of a trigger; default 12. */
  triggerBound?: number;
  /** Effects per run of a mission script; default 24. */
  missionBound?: number;
};

type Access = ChartFile["globals"][number];
export type Trace = ChartFile["traces"][number];
export type LaunchSite = ChartFile["launchSites"][number];
export type Conflict = ChartFile["conflicts"][number];

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Builds the thread graph of one program once and answers per-mission questions from it. */
export class ChartAssembler {
  readonly #entry: string;
  readonly #wasm: string;
  readonly #cleoDirs: string[];
  readonly #triggerBound: number;
  readonly #missionBound: number;
  readonly #missionRange: [number, number];
  readonly #phrasebook: string | undefined;
  readonly #library: string | undefined;
  #graph?: Promise<GraphData>;
  #source?: Promise<SourceProgram>;

  constructor(entry: string, wasm: string, options: AssemblerOptions = {}) {
    this.#entry = entry;
    this.#wasm = wasm;
    this.#cleoDirs = options.cleoDirs ?? [];
    this.#triggerBound = options.triggerBound ?? 12;
    this.#missionBound = options.missionBound ?? 24;
    this.#missionRange = options.missionRange ?? [1, 6];
    this.#phrasebook = options.phrasebook;
    this.#library = options.library;
  }

  /** Globals whose every write is 0, 1, `true`, or `false`: boolean flags, so `$V == 0` is the negation of `$V == 1`. */
  async #booleans(): Promise<Set<string>> {
    const writes = new Map<string, boolean>();
    for (const node of (await this.#build()).nodes) {
      for (const f of node.flags) {
        if (f.access !== "write") continue;
        const boolean = ["0", "1", "true", "false"].includes(
          (f.value ?? "").toLowerCase(),
        );
        writes.set(f.var, (writes.get(f.var) ?? true) && boolean);
      }
    }
    return new Set(
      [...writes].filter(([, boolean]) => boolean).map(([v]) => v),
    );
  }

  /**
   * The effect traces of each trigger that launches the mission, run with the lock free and held, and
   * of the mission script, run once with the lock held because it starts after the trigger takes the lock.
   * The lock is `$MissionLocked`, taken by `gosub @AcquireMissionLock`.
   */
  async traces(mission: string): Promise<Trace[]> {
    const sites = await this.launchSites(mission);
    const target = this.#find(await this.#build(), mission);
    const triggers = [...new Set(sites.map((s) => s.thread))].sort(compare);
    const graph = await new ThreadGraph(this.#entry, this.#wasm, {
      trackedVars: [],
      outline: [...triggers, target.id],
      cleoDirs: this.#cleoDirs,
    }).build();
    const out: Trace[] = [];
    const run = (
      id: string,
      lock: Trace["lock"],
      bound: number,
    ) => {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) throw new Error(`no script named ${id}`);
      const runs = FlowProgram.compile(node, candidateLock).cutRuns(
        lock === "free",
        bound,
      );
      for (const r of runs) {
        out.push({
          script: id,
          lock,
          bound,
          ...(r.cut ? { cut: true } : {}),
          effects: r.effects,
        });
      }
    };
    for (const id of triggers) {
      run(id, "free", this.#triggerBound);
      run(id, "held", this.#triggerBound);
    }
    run(target.id, "held", this.#missionBound);
    return out;
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
    const { items } = await this.#flow(mission);
    return MarksMerger.number(
      items.map(({ text, file, line }): RawStatement => ({ text, file, line })),
    );
  }

  /**
   * The states the marks cut the mission into, and the statements more than one state reaches.
   * A mark with no matching statement begins no state.
   */
  async states(mission: string, marks: Mark[]): Promise<StateOutput> {
    const flow = await this.#flow(mission);
    const statements = MarksMerger.number(
      flow.items.map(({ text, file, line }): RawStatement => ({
        text,
        file,
        line,
      })),
    );
    const anchors = MarksMerger.anchors(marks, statements);
    const guards = new GuardWriter(
      this.#phrasebook
        ? Phrasebook.parse(await Deno.readTextFile(this.#phrasebook))
        : Phrasebook.empty(),
      await this.#booleans(),
      this.#library ? loadLibrary(this.#library) : new Map(),
    );
    return deriveStates(
      flow,
      marks.flatMap((mark, i) => {
        const anchor = anchors[i];
        return anchor
          ? [{ item: statements.indexOf(anchor), label: mark.label }]
          : [];
      }),
      (g) => guards.write(g.mode, g.conditions, g.negated),
    );
  }

  /**
   * Every conflict that involves the mission. A `mission-thread` conflict pairs an access of a global the
   * mission touches with an access of a thread, and needs a write on one side. A `thread-thread` conflict
   * pairs writes of such a global by two threads. A `trigger-mission` conflict is a launch of a mission in
   * range with no read of `$ONMISSION` in its guard lines. Scripts of kind `mission` are never threads.
   */
  async conflicts(mission: string): Promise<Conflict[]> {
    const graph = await this.#build();
    const target = this.#find(graph, mission);
    const sitesOf = (node: GraphNode, name: string): Conflict["accesses"] => {
      const seen = new Set<string>();
      return node.flags.flatMap((f) => {
        const key = `${f.at.file}:${f.at.line}:${f.access}`;
        if (f.var !== name || f.access === "declare" || seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [{
          script: node.id,
          file: f.at.file,
          line: f.at.line,
          kind: f.access,
        }];
      });
    };
    const mine = [
      ...new Set(
        target.flags.filter((f) => f.access !== "declare").map((f) => f.var),
      ),
    ].sort(compare);
    const threads = graph.nodes.filter((n) => n.kind !== "mission");
    const out: Conflict[] = [];
    for (const name of mine) {
      for (const a of sitesOf(target, name)) {
        for (const t of threads) {
          for (const b of sitesOf(t, name)) {
            if (a.kind === "write" || b.kind === "write") {
              out.push({
                pair: "mission-thread",
                global: name,
                accesses: [a, b],
              });
            }
          }
        }
      }
      threads.forEach((first, i) => {
        for (const second of threads.slice(i + 1)) {
          for (
            const a of sitesOf(first, name).filter((s) => s.kind === "write")
          ) {
            for (
              const b of sitesOf(second, name).filter((s) => s.kind === "write")
            ) {
              out.push({
                pair: "thread-thread",
                global: name,
                accesses: [a, b],
              });
            }
          }
        }
      });
    }
    const [lo, hi] = this.#missionRange;
    for (const node of graph.nodes) {
      if (node.kind !== "mission" || node.mission === undefined) continue;
      if (node.mission < lo || node.mission > hi) continue;
      for (const { site, guards } of await this.#launches(node)) {
        if (guards.some(ChartAssembler.#readsLock)) continue;
        out.push({
          pair: "trigger-mission",
          global: "$ONMISSION",
          accesses: [{
            script: site.thread,
            file: site.file,
            line: site.line,
            kind: "write",
          }],
        });
      }
    }
    const rank = {
      "mission-thread": 0,
      "thread-thread": 1,
      "trigger-mission": 2,
    };
    return out.sort((x, y) =>
      rank[x.pair] - rank[y.pair] || compare(x.global, y.global) ||
      compare(x.accesses[0].file, y.accesses[0].file) ||
      x.accesses[0].line - y.accesses[0].line ||
      (x.accesses[1]?.line ?? 0) - (y.accesses[1]?.line ?? 0)
    );
  }

  /** True when an `if` or `while` header reads `$ONMISSION`. */
  static #readsLock(o: OutlineStatement): boolean {
    const text = "conditions" in o
      ? o.conditions.join(" ")
      : "condition" in o
      ? o.condition
      : "";
    return /\$ONMISSION\b/i.test(text);
  }

  async #flow(mission: string): Promise<FlowGraph> {
    const node = this.#find(await this.#build(), mission);
    const program = await this.#program();
    return FlowGraph.build(
      node.labels.map((label) => {
        const block = program.blocks.get(label)!;
        return {
          label,
          next: block.next,
          stmts: block.stmts.map((s) => ({
            outline: outlineOf(s.node),
            file: s.file,
          })),
        };
      }),
      (name) => program.resolve(name),
    );
  }

  /**
   * Each `Mission.LoadAndLaunchInternal` call that starts the mission, with the file, line, and thread
   * of the call. The guard lines are the header line of every enclosing `if` or `while`, and every
   * earlier `if ... goto_if_false` line in the same label block that falls through to the call.
   */
  async launchSites(mission: string): Promise<LaunchSite[]> {
    const target = this.#find(await this.#build(), mission);
    return (await this.#launches(target)).map(({ site }) => site);
  }

  /** The launch sites of a mission node, each with the guard statements on the way to it. */
  async #launches(
    target: GraphNode,
  ): Promise<{ site: LaunchSite; guards: OutlineStatement[] }[]> {
    const graph = await this.#build();
    const program = await this.#program();
    const found: { site: LaunchSite; guards: OutlineStatement[] }[] = [];
    for (const node of graph.nodes) {
      for (const edge of node.edges) {
        if (
          edge.kind !== "launch_mission" ||
          edge.target !== String(target.mission)
        ) continue;
        const stmts = program.blocks.get(edge.label)!.stmts
          .filter((s) => s.file === edge.at.file)
          .map((s) => outlineOf(s.node));
        const guards = [
          ...new Set(ChartAssembler.#guardsOf(stmts, edge.at.line) ?? []),
        ];
        found.push({
          guards,
          site: {
            file: edge.at.file,
            line: edge.at.line,
            thread: node.id,
            guardLines: [...new Set(guards.map((g) => g.line))].sort((a, b) =>
              a - b
            ),
          },
        });
      }
    }
    return found.sort((a, b) =>
      compare(a.site.file, b.site.file) || a.site.line - b.site.line
    );
  }

  /** The guard statements on the way to the statement at `line`, or undefined when it is not in `list`. */
  static #guardsOf(
    list: OutlineStatement[],
    line: number,
  ): OutlineStatement[] | undefined {
    const earlier: OutlineStatement[] = [];
    for (const o of list) {
      if (o.line === line && !("then" in o) && !("body" in o)) return earlier;
      const inner = "then" in o
        ? [o.then, o.else ?? []]
        : "body" in o
        ? [o.body]
        : [];
      for (const branch of inner) {
        const found = ChartAssembler.#guardsOf(branch, line);
        if (found) return [...earlier, o, ...found];
      }
      if ("target" in o) earlier.push(o);
    }
    return undefined;
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
