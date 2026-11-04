import { assert, assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  type GraphData,
  type GraphNode,
  ThreadGraph,
} from "../tools/thread-graph/graph.ts";
import { FlowProgram, type Ins } from "../tools/flow-model/program.ts";
import {
  baselineLock,
  bound,
  candidateLock,
  triggers,
} from "../tools/flow-model/config.ts";
import {
  GraphLimitError,
  StateGraph,
  ThreadProgram,
} from "../tools/flow-model/state-graph.ts";
import { ShortestPaths } from "../tools/flow-model/shortest-paths.ts";

// Checks the state graph tracer: the graph of a thread agrees with the effect traces of `FlowProgram.runs`,
// shortest paths agree with `endingDepths`, and the Cop graph builds inside a 1500 MB heap.
//   deno test -R -E --allow-run --env-file=.env lib/state-graph.test.ts

const root = join(import.meta.dirname!, "..");
const wasm = Deno.env.get("SBL_WASM");
assert(wasm, "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env");

const baseline = JSON.parse(
  await Deno.readTextFile(
    join(root, "lib", "fixtures", "thread-graph.baseline.json"),
  ),
) as GraphData;
const live = await new ThreadGraph(join(root, "main.txt"), wasm, {
  trackedVars: [],
  outline: triggers,
  cleoDirs: ["lib/threads"],
}).build();

function node(graph: GraphData, id: string): GraphNode {
  const found = graph.nodes.find((n) => n.id === id);
  assert(found, `no node ${id}`);
  return found;
}

/** Every effect trace of up to `bound` effects read off the graph, as `FlowProgram.runs` lists them. */
function traces(graph: StateGraph, limit: number): string[][] {
  let previous = new Map<number, Set<string>>();
  for (let id = 0; id < graph.size; id++) {
    previous.set(id, new Set([JSON.stringify([])]));
  }
  for (let level = 1; level <= limit; level++) {
    const current = new Map<number, Set<string>>();
    for (let id = 0; id < graph.size; id++) current.set(id, new Set());
    let changed = true;
    while (changed) {
      changed = false;
      for (let id = 0; id < graph.size; id++) {
        const out = current.get(id)!;
        const before = out.size;
        const edges = graph.edges(id);
        if (edges.length === 0) out.add(JSON.stringify([]));
        for (const edge of edges) {
          if (edge.kind === "effect") {
            for (const t of previous.get(edge.to)!) {
              out.add(JSON.stringify([edge.text, ...JSON.parse(t)]));
            }
          } else for (const t of current.get(edge.to)!) out.add(t);
        }
        if (out.size !== before) changed = true;
      }
    }
    previous = current;
  }
  return [...previous.get(graph.start)!].map((t) => JSON.parse(t) as string[])
    .sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
}

for (const id of triggers) {
  for (const lockFree of [true, false]) {
    const held = lockFree ? "free" : "held";
    Deno.test(`${id}: baseline graph traces equal FlowProgram.runs, lock ${held}`, () => {
      const flow = FlowProgram.compile(node(baseline, id), baselineLock);
      const graph = StateGraph.build(
        ThreadProgram.compile(node(baseline, id), baselineLock),
        { lockFree },
      );
      assertEquals(traces(graph, bound), flow.runs(lockFree, bound));
    });
    Deno.test(`${id}: current graph traces equal FlowProgram.runs, lock ${held}`, () => {
      const flow = FlowProgram.compile(node(live, id), candidateLock);
      const graph = StateGraph.build(
        ThreadProgram.compile(node(live, id), candidateLock),
        { lockFree },
      );
      assertEquals(traces(graph, bound), flow.runs(lockFree, bound));
    });
  }
}

const program = (ins: Ins[]) => ThreadProgram.of(ins, "T");

Deno.test("a guard header reads every condition and the result is the and of all", () => {
  const graph = StateGraph.build(
    program([
      { op: "br", mode: "and", atoms: ["died", "arrested"], t: 1, f: 1 },
      { op: "stop" },
    ]),
    { lockFree: true },
  );
  const edges = graph.edges(graph.start).filter((e) => e.kind === "guard");
  const flagsAfter = (outcome: boolean) =>
    edges.filter((e) => e.kind === "guard" && e.outcome === outcome).map((e) =>
      graph.state(e.to).flags
    ).sort();
  // died is bit 1 and arrested is bit 2: true needs both, false may leave either one set, because both are read.
  assertEquals(flagsAfter(true), [3]);
  assertEquals(flagsAfter(false), [0, 1, 2]);
  for (const edge of edges) {
    assert(edge.kind === "guard");
    assertEquals(edge.conditions.length, 2);
  }
});

Deno.test("a guard header reads every condition and the result is the or of all", () => {
  const graph = StateGraph.build(
    program([
      { op: "br", mode: "or", atoms: ["died", "arrested"], t: 1, f: 1 },
      { op: "stop" },
    ]),
    { lockFree: true },
  );
  const edges = graph.edges(graph.start);
  const flagsAfter = (outcome: boolean) =>
    edges.filter((e) => e.kind === "guard" && e.outcome === outcome).map((e) =>
      graph.state(e.to).flags
    ).sort();
  assertEquals(flagsAfter(false), [0]);
  assertEquals(flagsAfter(true), [1, 2, 3]);
});

Deno.test("a guard edge carries the text and line of its conditions", () => {
  const thread = {
    id: "T",
    outline: [{
      label: "T",
      at: { file: "t.txt", line: 1 },
      statements: [{
        kind: "if",
        line: 7,
        mode: "and",
        conditions: ["has_deatharrest_been_executed", "$A  ==  1"],
        then: [{
          kind: "function_call",
          line: 8,
          text: "Text.Print('A', 1, 1)",
        }],
      }],
    }],
  } as unknown as GraphNode;
  const graph = StateGraph.build(
    ThreadProgram.compile(thread, baselineLock),
    { lockFree: true },
  );
  const guard = graph.edges(graph.start).find((e) => e.kind === "guard");
  assert(guard && guard.kind === "guard");
  assertEquals(guard.line, 7);
  assertEquals(guard.conditions.map((c) => c.text), [
    "has_deatharrest_been_executed",
    "$A == 1",
  ]);
  const effect = graph.edges(
    graph.edges(graph.start).find((e) => e.kind === "guard" && e.outcome)!.to,
  )[0];
  assert(effect.kind === "effect");
  assertEquals([effect.text, effect.line], ["Text.Print('A', 1, 1)", 8]);
});

Deno.test("two paths to the same instruction, stack, acquire result, and flags are one state", () => {
  const graph = StateGraph.build(
    program([
      { op: "br", mode: "and", atoms: ["free"], t: 1, f: 2 }, // 0
      { op: "eff", text: "a" }, // 1
      { op: "eff", text: "b" }, // 2
      { op: "stop" }, // 3
    ]),
    { lockFree: true },
  );
  // pc 0, pc 1, pc 2, pc 3
  assertEquals(graph.size, 4);
});

Deno.test("a loop is a cycle in the graph and a state with no edge is an ending", () => {
  const graph = StateGraph.build(
    program([
      { op: "br", mode: "and", atoms: ["free"], t: 1, f: 3 }, // 0
      { op: "eff", text: "tick" }, // 1
      { op: "jmp", to: 0 }, // 2
      { op: "stop" }, // 3
    ]),
    { lockFree: true },
  );
  assertEquals(graph.size, 4);
  const tick = graph.edges(graph.start).find((e) =>
    e.kind === "guard" && e.outcome
  )!;
  const back = graph.edges(graph.edges(tick.to)[0].to)[0];
  assertEquals(back.to, graph.start);
  assertEquals(graph.endings().map((id) => graph.state(id).pc), [3]);
});

Deno.test("a long thread builds without recursion", () => {
  const ins: Ins[] = [];
  for (let i = 0; i < 100_000; i++) ins.push({ op: "eff", text: `e${i}` });
  ins.push({ op: "stop" });
  const graph = StateGraph.build(program(ins), {
    lockFree: true,
    stateCap: 200_000,
  });
  assertEquals(graph.size, 100_001);
});

Deno.test("a return stack deeper than the call cap stops the build and names the cap", () => {
  const error = assertThrows(
    () =>
      StateGraph.build(program([{ op: "call", to: 0 }, { op: "stop" }]), {
        lockFree: true,
        callCap: 5,
      }),
    GraphLimitError,
  );
  assert(error.message.includes("call cap 5"), error.message);
});

Deno.test("a state count past the state cap stops the build and names the cap", () => {
  const error = assertThrows(
    () =>
      StateGraph.build(
        program([
          { op: "eff", text: "a" },
          { op: "eff", text: "b" },
          { op: "eff", text: "c" },
          { op: "stop" },
        ]),
        { lockFree: true, stateCap: 3 },
      ),
    GraphLimitError,
  );
  assert(error.message.includes("state cap 3"), error.message);
});

const endingsOf = (id: string) => {
  const thread = node(baseline, id);
  const flow = FlowProgram.compile(thread, baselineLock);
  const graph = StateGraph.build(
    ThreadProgram.compile(thread, baselineLock),
    { lockFree: true },
  );
  return { flow, graph, paths: new ShortestPaths(graph).endings() };
};

for (const [id, depth] of [["Intro", 50], ["Cop", 159]] as const) {
  Deno.test(`${id}: shortest distances equal endingDepths, and the deepest is ${depth}`, () => {
    const { flow, paths } = endingsOf(id);
    assertEquals(
      paths.map((p) => ({ pc: p.pc, depth: p.depth })),
      flow.endingDepths(true),
    );
    assertEquals(Math.max(...paths.map((p) => p.depth)), depth);
    for (const path of paths) {
      assertEquals(
        path.steps.filter((s) => s.kind === "effect").length,
        path.depth,
      );
    }
  });
}

Deno.test("the shortest path to an ending names each guard outcome and its line", () => {
  const { paths } = endingsOf("Cop");
  const guards = paths.flatMap((p) => p.steps).filter((s) =>
    s.kind === "guard"
  );
  assert(guards.length > 0);
  for (const guard of guards) {
    assert(guard.kind === "guard");
    assert(guard.conditions.length > 0);
    assert(guard.line > 0);
  }
});

Deno.test("the Cop graph builds inside a 1500 MB heap", async () => {
  const module = import.meta.resolve("../tools/flow-model/state-graph.ts");
  const config = import.meta.resolve("../tools/flow-model/config.ts");
  const code = `
    import { StateGraph, ThreadProgram } from ${JSON.stringify(module)};
    import { baselineLock } from ${JSON.stringify(config)};
    const g = JSON.parse(await Deno.readTextFile(${
    JSON.stringify(join(root, "lib", "fixtures", "thread-graph.baseline.json"))
  }));
    const n = g.nodes.find((x) => x.id === "Cop");
    const graph = StateGraph.build(ThreadProgram.compile(n, baselineLock), { lockFree: true });
    console.log("states=" + graph.size);
  `;
  const out = await new Deno.Command(Deno.execPath(), {
    args: [
      "eval",
      "--v8-flags=--max-old-space-size=1500",
      "-A",
      code,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(out.stdout) +
    new TextDecoder().decode(out.stderr);
  assert(out.success, text);
  assert(/states=\d+/.test(text), text);
});
