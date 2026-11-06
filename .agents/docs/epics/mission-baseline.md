# Mission Baseline

## Purpose

The baseline maps how each in-scope mission script works today. Mutex and state
machine work starts from that map. Refactoring waits until the baseline exists.

## Scope

- Missions 1 to 6. Prototypes 7 to 10 are out of scope.
- Threads that an in-scope mission starts, reads, or writes.
- Behavior comes from a program that reads the source. No recorded game run is
  part of the baseline.

## Concurrency Model

- One mission runs at a time. The engine enforces this through `$ONMISSION`.
- Threads run whenever, alongside the main thread and each other.
- The baseline exposes three conflict pairs:

| Pair                       | Meaning                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| Mission vs thread          | A thread reads or writes a global that the running mission also reads or writes. |
| Thread vs thread           | Two threads write the same global.                                               |
| Trigger vs running mission | A trigger starts a mission while another mission holds `$ONMISSION`.             |

## Outputs

| Output                                                                                | Role                                                                                                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Machine JSON, one file per mission at `missions/<name>.chart.json`, beside the script | Source of truth.                                                                                                            |
| HTML page per mission                                                                 | Generated from the JSON. Never hand-authored. Author marks save through a local Deno server that writes the mission's JSON. |

## Content Per Mission

The JSON records, for each in-scope mission:

- Shared globals: each global read or written, and the thread or mission that
  does it.
- State machine: states, guards, and transitions. A state is a division the
  mission author marks in the chart HTML. Waits never mark a state by
  themselves. With no marks, a mission is one state. Each mark stores the text
  of the statement it sits on and an optional label, a story beat the author
  names. The mission script is the upstream source, so a change to it changes
  the chart.
- Launch sites: each `Mission.LoadAndLaunchInternal` call that starts the
  mission, with its file, line, enclosing thread, and the guard lines around it.
- Conflicts: each of the three pairs above that involves the mission, with both
  access sites (file, line, and access kind).
- Behavior: the full effect traces a static program derives from the source, at
  trace bound 24. The bound is unmeasured: `tools/flow-model` uses 12 today, and
  AGENTS.md records that 40 exhausts a 1500 MB heap for Cop and Intro.

## Tool

`tools/chart` is a new Deno workspace package. It charts control flow and thread
graphs, and it describes each mission for mission authors. It reuses the
existing static tools where they apply:

| Existing tool        | Use in `tools/chart`                             |
| -------------------- | ------------------------------------------------ |
| `tools/cfg`          | Control-flow blocks.                             |
| `tools/thread-graph` | Threads, and reads and writes of listed globals. |
| `tools/flow-model`   | Effect traces.                                   |

## Local Server

- A new `deno.json` task, `chart:serve`, starts the local server that writes
  author marks into the mission's JSON.

## Future Iterations

- The Gherkin, spec, and Lean files on `fix/mutual-exclusion`
  (`missions/*.feature`, `lib/specs/`, `lib/mission-lock.lean`, the spec
  command) are kept. Their fate is decided after the intro chart is reviewed.
  Nothing is deleted without the user's confirmation per file.
