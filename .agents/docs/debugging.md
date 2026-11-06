# Debugging Tools

- To debug a crash, read `scrlog.log` in the game folder. It lists each thread
  per frame with its instruction pointer. Hazards found so far are in
  [.agents/bugs/death-and-bust-hazards.md](../../.agents/bugs/death-and-bust-hazards.md).
- `deno task extract-skins` defaults to the name `IGMerc`, the mesh that every
  outfit slot copies. Output goes to `skins/`, where Git ignores the `.dff` and
  `.txd` files because they are game assets.
- `deno task --cwd tools/cfg start ../../main.txt <label>` prints the
  control-flow blocks reachable from a label as one JSON line each. It resolves
  `{$INCLUDE}` lines, follows `goto`, calls, fall-through, and
  `start_new_script`, and records `Mission.LoadAndLaunchInternal` without
  following it. `tools/cfg` is a Deno workspace member (`@eventide/cfg`).
- `deno task --cwd tools/thread-graph start ../../main.txt --vars '$ONMISSION' --outline Star,HOT`
  prints the graph of every thread and mission reachable from `MAIN`, breadth
  first, as JSON: start, launch, stream, and terminate edges, reads and writes
  of the listed variables, and the full statements of the listed entry labels.
  It parses with the `tree-sitter-gta3` wasm named by `SBL_WASM` in `.env`, and
  matches labels without regard to letter case. `tools/thread-graph` is a Deno
  workspace member (`@eventide/thread-graph`).
  [lib/thread-graph.test.ts](../../lib/thread-graph.test.ts) compares the graph
  with [lib/fixtures/thread-graph.json](../../lib/fixtures/thread-graph.json);
  run it with `deno test -R -E --env-file=.env lib/thread-graph.test.ts`. The
  model notes are in
  [.agents/lessons/mission-lock-model.md](../../.agents/lessons/mission-lock-model.md).
- `tools/flow-model` (`@eventide/flow-model`) compiles the seven mission
  triggers to instruction lists and compares their effect traces with the
  baseline
  [lib/fixtures/thread-graph.baseline.json](../../lib/fixtures/thread-graph.baseline.json).
  `deno test -R -E --env-file=.env lib/mission-flow.test.ts` runs the
  comparison, and it fails on the held-lock checks until the triggers take the
  mission lock. Enumerating every trace of Cop or Intro at bound 40 exhausts a
  1500 MB heap.
- `deno task --cwd tools/flow-model capped [--cwd=<dir>] <memoryMB> <timeoutSeconds> <command> [args...]`
  runs a command in a Windows job object with a hard memory limit and a timeout.
  Run any heavy trace enumeration through it.
- `deno task chart <mission> [--missions <dir>]` reads
  `missions/<mission>.chart.json` and stops with a message that names the
  version when the schema version is unknown or the file is invalid.
  `tools/chart` (`@eventide/chart`) is a Deno workspace member that imports the
  other three tools through their `mod.ts`. The plan is
  [.agents/plans/mission-baseline.md](../../.agents/plans/mission-baseline.md).
