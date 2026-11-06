---
audience: [ai, human]
status: draft
---
# Mission Baseline Acceptance Criteria

Criteria for each item in [mission-baseline.md](mission-baseline.md). Tick a box the turn its check passes.

## Schema

- [x] `tools/chart` exists as a Deno workspace package named `@eventide/chart`, listed in the root `deno.json` workspace list.
- [x] A JSON schema for `missions/<name>.chart.json` has a `version` field, and a file with an unknown version stops the run with a message that names the version.
- [x] `AGENTS.md` has a run line for `tools/chart`.
- [x] The tool takes the mission as an argument and names no mission in its code.

## Exports

- [x] `tools/cfg`, `tools/thread-graph`, and `tools/flow-model` each expose a library entry point that `tools/chart` imports by package name.
- [x] The existing command-line behavior of the three tools is unchanged, and `lib/thread-graph.test.ts` and `lib/mission-flow.test.ts` give the same results as before the change.

## Globals

- [ ] The JSON for each of missions 1 to 6 lists every global the mission reads or writes, with the thread or mission that does it.
- [ ] The list includes globals reached through `{$INCLUDE}` files.
- [ ] Each entry says whether the access is a read or a write.

## Launch Sites

- [ ] The JSON for each of missions 1 to 6 lists every `Mission.LoadAndLaunchInternal` call that starts it.
- [ ] Each site has its file, line, enclosing thread, and the guard lines around it.
- [ ] Mission 7 and the `Mission.LoadAndLaunchInternal(0)` calls are absent from the launch sites of missions 1 to 6.

## Conflicts

- [ ] Each conflict names one of the pairs `mission-thread`, `thread-thread`, or `trigger-mission`.
- [ ] Each conflict has two access sites, each with file, line, and access kind.
- [ ] A `trigger-mission` conflict appears for a trigger that starts a mission without testing `$ONMISSION`.
- [ ] A thread that touches no global of the mission produces no conflict.

## State Machine

- [ ] A mission with no marks is one state.
- [ ] A wait statement never creates a state.
- [ ] Each mark begins one state, and the state carries the mark's label when it has one.
- [ ] Guards and transitions between marked states come from the control-flow blocks of `tools/cfg`.

## Behavior

- [ ] Effect traces come from `tools/flow-model` and are stored with the bound they were run at.
- [ ] Trace bound 24 is measured for each mission with the `tools/flow-model` library before the bound is kept, and the measured counts are recorded where the bound is recorded.
- [ ] A run that exceeds the memory cap or the timeout stops with a message that names the cap that fired.
- [ ] Heavy runs go through the capped runner, and `decide +kernel` appears nowhere.

## Marks

- [ ] A mark stores the statement text and an optional label.
- [ ] A run rewrites the derived content and leaves every mark as it was.
- [ ] After a source edit that moves a statement, the mark follows the statement.
- [ ] A mark whose statement is gone is listed as orphaned and stays in the JSON until the author confirms its removal.
- [ ] Two identical statements in one mission anchor by order of appearance.

## Pages

- [ ] `deno task chart <mission>` writes `dist/charts/<mission>.html` from the JSON.
- [ ] No page is hand-authored, and deleting `dist/charts` and running the task again restores every page.
- [ ] A page shows the globals, launch sites, conflicts, states, and traces of its mission, and a mark control on each statement.
- [ ] A page loads through `chart:serve` with its styles and script applied.

## Server

- [ ] `deno task chart:serve` starts a server bound to `127.0.0.1`.
- [ ] `POST /<mission>/marks` adds, relabels, or removes a mark in `missions/<mission>.chart.json`.
- [ ] A request for a name outside missions 1 to 6 is rejected, and nothing is written.
- [ ] The server writes a temporary file and renames it, so a stop mid-write leaves the old JSON.

## Tests

- [ ] A golden test compares the derived JSON of each of missions 1 to 6 with a stored copy, in the style of `lib/thread-graph.test.ts`.
- [ ] A marks round trip test adds a mark through the server and reads it back from the JSON.
- [ ] An orphan test removes a statement and finds the mark listed as orphaned.
- [ ] A server write test checks the path restriction and the rename.
- [ ] The tests run with `deno test` and the permissions each file needs.
