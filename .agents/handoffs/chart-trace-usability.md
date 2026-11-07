# Handoff: Make Mission Traces Easier to Follow

Date: 2026-11-07. Repository: The Eventide Chronicles. Branch:
`fix/mutual-exclusion`.

## Focus for the Next Session

The chart IDE in `tools/chart` is the target. The user reports the effect traces
are impossible to grok, even with the visual stepping. Missions carry hundreds
of traces.

Purpose of the traces, per the user: map threads of logic so future refactors
can use them. Main uses are Mission Foundry refactoring, and removing gotos and
labels in favor of classical control flow (if, while, and similar). Traces must
therefore show the logic structure a refactor needs, not only a replay of one
run.

Goal: brainstorm and grill ways to make traces easy to trace for that purpose.
Output is design options and decisions, not code, until the user approves a
direction.

The session should open with a grill (AskUserQuestion, one frontier per round),
per the user's request.

## Current State

- Mission baseline: every work item is done; the epic is
  `.agents/docs/epics/mission-baseline.md`. The Tests item's files are
  uncommitted. The user owns commits.
- Full `tools/chart` suite: 76 passed, 0 failed
  (`deno test -R -W -E --allow-run --env-file=.env tools/chart`).
- Golden test: `tools/chart/golden.test.ts`, fixtures in `lib/fixtures/chart/`.
  Regenerate only with `UPDATE_FIXTURE=1` after a reviewed change.
- Working tree also has unrelated in-progress edits from earlier work
  (`deno.json`, `tools/chart/*`, `docs/superpowers/`). Do not touch them without
  asking.

## Trace Scale (from `missions/*.chart.json`, read this session)

| Mission | Traces | Effects | Cut at bound |
| ------- | ------ | ------- | ------------ |
| intro   | 34     | 368     | 16           |
| cop     | 70     | 1306    | 56           |
| hotel   | 235    | 4780    | 195          |
| work    | 27     | 274     | 13           |
| cart    | 45     | 464     | 19           |
| bossdie | 83     | 1096    | 43           |

Most of `hotel` is cut at the bound, so most of its traces are prefixes, not
complete runs.

## Trace Model (where to look)

- Generation: `tools/chart/traces.ts`, using `tools/flow-model` (`cutRuns`).
  Trigger bound 12, mission script bound 24. Each trace is
  `{script, lock, bound, cut?, effects[]}`. Schema in
  `tools/chart/chart.schema.json` and `tools/chart/schema.ts`.
- Trace design decision: `@remarks` in `tools/chart/schema.ts`,
  `tools/chart/traces.ts`, and `tools/chart/assembler.ts`.
- Rendering: `tools/chart/render.ts` (trace switcher, rails container, scrubber,
  branch template; see `tools/chart/render.test.ts`).
- Client behavior: `tools/chart/static/chart.js`, styles in
  `tools/chart/static/chart.css`.
- Server: `tools/chart/server.ts`, task `deno task chart:serve`.
- Mission epic and scope: `.agents/docs/epics/mission-baseline.md`.

## Known Facts Relevant to the Focus

- Each trace lists effects as flat strings; no grouping, no shared prefixes
  across traces.
- Trace identity is script + lock + bound. The user needs a way to see which
  traces share a prefix and where they diverge.
- Cut traces have no end state and are treated as errors by the user (see Grill
  Answers).
- Traces run for trigger with lock free and held, and mission script with lock
  held (`assembler.ts`, `traces()`).

## Grill Answers So Far

- Round 1, pain points: the user chose "Too many traces" and "Traces look
  alike". Their purpose is the refactor mapping above.
- Round 2, basis: "Both, linked". The statement graph (`tools/cfg`,
  `--statements`) is the main view. Traces open from a selected node and show
  the runs that pass through it.
- Round 2, unit: mixed. Per state first, then per script as today.
- Blocker: the user reports marking story beats is broken in the charting app.
  Per-state views depend on marks, so this blocks the per-state view. The user
  will raise it later. Do not fix or design it until asked.
- Round 3, grouping: group smartly by branching logic. The user does not want a
  hundred traces that repeat the same few segments. The view must show the
  branching logic, not individual traces.
- Round 3, filters: pass or fail end state, trigger, lock state, cut flag.
- Round 3, step view: effects with source lines, effect deltas, and important
  branching logic (which branches count as important is not yet defined).
- Round 3, paging: show all traces, grouped by pass or fail and end tag.
- Round 4, important branches: conditionals (`if`, `while`, `goto_if_false`
  headers, condition shown), labels and gotos. `gosub` calls fold into one logic
  branch with call-return separators.
- Round 4, end-state tags: "Reached script end", "Cut at bound", "Waits
  forever", "Lock refused". Round 5 sets the classes below.
- Round 4, node link: both. A summary of outgoing branches with trace counts by
  default, expandable to the runs through the node.
- Correction to the earlier "Cut traces" fact: the user states a cut trace is an
  error to rectify. Every execution must be traced from start to finish. Hotel's
  195 cut traces, and 13 to 56 per other mission, are therefore open errors, not
  a display issue. The epic (`.agents/docs/epics/mission-baseline.md`, Behavior
  section) records that bound 40 exhausts a 1500 MB heap for Cop and Intro.
  Raising the bound or changing the enumeration is a separate decision.
- Round 5, end-state classes: "Waits forever" and "Lock refused" are each a
  separate class, neither pass nor fail.
- Round 5, cut fix: the user does not know the approach and asked for a lookup
  of control-flow graphing techniques. Two search snippets were collected this
  session and are unverified; the user has not reviewed them (see Cut-Fix
  Research).

## Current Trace Charting (read from code this session)

- The app has no statement graph view yet. Traces draw on the source view
  (`[data-editor-view="script"]`), not a graph.
- `tools/chart/static/chart.js`, `drawSvgRails` (about line 1119): each trace
  step is a node in a gutter SVG beside the source. Consecutive steps on nearby
  lines get a straight rail. A jump (line difference greater than 2) gets a
  dashed curve with an arrowhead. Clicking a node calls `goToStep`.
- `insertBranchCards` (about line 1220): a card is inserted after each jump
  step, showing the condition, the target line, and a jump link.
- `goToStep` plus the scrubber in `tools/chart/render.ts` (about line 352):
  prev, next, close, and a step counter. Keys p, n, and Esc.
- `getTraceOutcome` (about line 1105): `cut` gives "loop", effect text
  containing "fail", "wasted", or "bust" gives "fail", anything else gives
  "pass". This does not match the user's classes: cut is an error, and "Waits
  forever" and "Lock refused" are not produced at all. Open: the code needs the
  new classes.
- Trace switcher: a select (`#trace-select`) lists every trace (`render.ts`,
  about line 217). Hotel's 235 traces are all in one select.

## Cut-Fix Research

Lookup this session, two web searches. Claims below rest on search snippets, not
fetched pages. Fetch the sources before relying on any detail.

- Path explosion and loop bounding trade completeness for coverage: a loop bound
  can miss flows completed after the bound. Source:
  [LLVM cfe-dev path explosion thread](https://lists.llvm.org/pipermail/cfe-dev/2011-May/015146.html)
  (snippet only).
- State merging combines states at one program point. It reduces path count but
  makes path conditions harder to solve. Dynamic merging (merge only when it
  looks advantageous) is in Kuznetsov et al., PLDI 2012:
  [pldi12 statemerging](https://www.plai.ifi.lmu.de/publications/pldi12-statemerging.pdf).
  Practical example:
  [Symbolic Path Merging in Manticore](https://blog.trailofbits.com/2019/01/25/symbolic-path-merging-in-manticore/)
  (snippet only).
- Loop compression by merging states per iteration:
  [Extracting Protocol Format as State Machine via Controlled Static Loop Analysis](https://arxiv.org/html/2305.13483v4)
  (snippet only).
- Structuring a CFG into if, while, and break without gotos (display side, not
  coverage): Cifuentes' structuring algorithm,
  [structuring-algorithm.pdf](https://www.cs.tufts.edu/~nr/cs257/archive/cristina-cifuentes/structuring-algorithm.pdf);
  DREAM, goto-free pattern-independent structuring,
  [NDSS 2017](https://www.ndss-symposium.org/wp-content/uploads/2017/09/11_4_2.pdf);
  a 2026 survey, [arXiv 2608.24955](https://arxiv.org/pdf/2608.24955). Snippets
  say goto elimination can cause duplication and deep nesting, and irreducible
  graphs need node splitting first.
- Node splitting to reducible form, then single-exit loops, as a practical
  recipe:
  [LLVM discourse thread](https://discourse.llvm.org/t/ot-control-flow-graph-cfg-into-abstract-syntax-tree-ast/24479)
  (snippet only).

Two separate problems are in play. Coverage (cut traces) is about enumeration:
bound, merging, or both. Display (branching logic) is about structuring the
graph. Options for coverage: raise the bound with measured memory per mission,
merge states during enumeration (PLDI 2012 style), or both. The user decides
which.

Next session: the user asked that it look up control-flow graphing techniques
for the cut traces and fetch each source before citing it.

- Round 6, coverage: "Both, measure first". Measure bounds per mission under the
  capped runner, then merge states only where the bound still cuts.
- Round 6, path view: "Both views". Keep the source rails for one selected
  trace, and add a graph panel that shows all traces through a node.

## Open Questions for the Grill (not decided)

1. Graph panel: built from `tools/cfg` statement graph (`--statements`), or
   another source. Layout and node count for hotel's graph are unknown until
   measured.
2. Branch summary: which counts show per branch (trace count, pass or fail
   split), and how it is computed from `traces`.
3. End-state classes in code: `getTraceOutcome` must produce "cut" as error,
   plus "waits forever" and "lock refused" as separate classes. Confirm the
   labels.
4. Measurement plan for the coverage fix: which bounds to try per mission, and
   the memory cap. Needs the user's go-ahead before the runs, since they are
   heavy.
5. Per-state view with marks broken: wait for the user's direction on the
   marking fix.

## Constraints

- Chart JSON is the source of truth. Pages are generated, never hand-authored
  (`.agents/docs/epics/mission-baseline.md`).
- Marks write only through the local server to `missions/<mission>.chart.json`.
- Palette and visual identity: `docs/visual-identity.md`, `docs/palette.csv`.
  Read before any art, font, color, or HUD change.
- Commits: user only. Do not run `git commit` without written permission per
  commit.
- Reply style: graphics over text, caveman output style active in chat.
- Use title case for headings in documents. No em dashes. Oxford commas.

## Suggested Skills

- `grilling`: run the design interview on the open questions above.
- `brainstorming`: explore trace-view options before design.
- `comparing-visual-options`: show trace-view options as specimens for the user
  to pick (per `AGENTS.md`, specimens go in `docs/specimens`).
- `artifact-design` and `artifact-diagramming`: before any published or visual
  artifact.
- `dataviz`: before any chart, tile, or scrubber design.
- `writing-plans` and `impl-work-item`: once a direction is approved and a plan
  item exists.
- `writing-documentation`: before editing any README, design doc, or code
  comment.
- `sanny-guidance`: only if a trace points at a script line that needs Sanny
  context.

## First Steps

1. Read `tools/chart/render.ts`, `tools/chart/static/chart.js`, and one
   generated page's trace section (`deno task chart:serve`, open a mission
   page).
2. Confirm which traces the user finds unreadable (hotel, the largest, is the
   likely case).
3. Grill the open questions one frontier at a time.
