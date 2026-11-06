---
audience: [ai, human]
status: draft
---

# Mission Baseline Acceptance Criteria

Criteria for each item in [mission-baseline.md](mission-baseline.md). Tick a box
the turn its check passes.

## Schema

- [x] `tools/chart` exists as a Deno workspace package named `@eventide/chart`,
      listed in the root `deno.json` workspace list.
- [x] A JSON schema for `missions/<name>.chart.json` has a `version` field, and
      a file with an unknown version stops the run with a message that names the
      version.
- [x] `AGENTS.md` has a run line for `tools/chart`.
- [x] The tool takes the mission as an argument and names no mission in its
      code.

## Exports

- [x] `tools/cfg`, `tools/thread-graph`, and `tools/flow-model` each expose a
      library entry point that `tools/chart` imports by package name.
- [x] The existing command-line behavior of the three tools is unchanged, and
      `lib/thread-graph.test.ts` and `lib/mission-flow.test.ts` give the same
      results as before the change.

## Globals

- [x] The JSON for each of missions 1 to 6 lists every global the mission reads
      or writes, with the thread or mission that does it.
- [x] The list includes globals reached through `{$INCLUDE}` files.
- [x] Each entry says whether the access is a read or a write.

## Launch Sites

- [x] The JSON for each of missions 1 to 6 lists every launch site: each place
      where a trigger launches it with `Mission.LoadAndLaunchInternal`.
- [x] Each site has its file, line, trigger thread, and its guard lines: the
      header line of every enclosing `if` or `while`, and every earlier
      `if ... goto_if_false` line in the same label block that falls through to
      it.
- [x] Mission 7 and the `Mission.LoadAndLaunchInternal(0)` calls are absent from
      the launch sites of missions 1 to 6.

## Conflicts

- [ ] Each conflict names one of the pairs `mission-thread`, `thread-thread`, or
      `trigger-mission`.
- [ ] Each conflict has two access sites, each with file, line, and access kind.
- [ ] A `trigger-mission` conflict appears for a trigger that starts a mission
      without testing `$ONMISSION`.
- [ ] A thread that touches no global of the mission produces no conflict.

## State Machine

- [ ] A mission with no marks is one state.
- [ ] A wait statement never creates a state.
- [ ] Each mark begins one state, and the state carries the mark's label when it
      has one.
- [ ] Guards and transitions between marked states come from the control-flow
      blocks of `tools/cfg`.

## Behavior

- [ ] Effect traces come from `tools/flow-model`.
- [ ] Each trace stores its `script`, its `lock` (`free` or `held`), its `bound`,
      a `cut` flag that is true when the run hit the bound before the script
      ended, and its `effects` as an ordered array of strings.
- [ ] The chart has no top-level `traceBound` in the schema, the tool, the
      tests, or the `missions/*.chart.json` files.
- [ ] Each mission has traces of its trigger with the lock free and with the lock
      held, and traces of its mission script with the lock held.
- [ ] Triggers run at bound 12. Mission scripts run at bound 24, measured for
      each mission with the `tools/flow-model` library before the bound is kept.
      The JSON stores only each trace's bound, not the measured counts.
- [ ] A run that exceeds the memory cap or the timeout stops with a message that
      names the cap that fired.
- [ ] Heavy runs go through the capped runner, and `decide +kernel` appears
      nowhere.

## Marks

- [x] A mark stores the statement text and an optional label.
- [x] A run rewrites the derived content and leaves every mark as it was.
- [x] After a source edit that moves a statement, the mark follows the
      statement.
- [x] A mark whose statement is gone is listed as orphaned and stays in the JSON
      until the author confirms its removal.
- [x] Two identical statements in one mission anchor by order of appearance.

## Pages

- [ ] `deno task chart <mission>` writes `dist/charts/<mission>.html` from the
      JSON.
- [ ] No page is hand-authored, and deleting `dist/charts` and running the task
      again restores every page.
- [ ] A page shows the globals, launch sites, conflicts, states, and traces of
      its mission, and a mark control on each statement.
- [ ] A page loads through `chart:serve` with its styles and script applied.
- [ ] A page shows each orphaned mark as an error in its place in the state
      list, with its label kept.
- [ ] An orphaned mark has an "Accept Suggestion" button that moves it onto the
      statement whose text is most similar to the mark's.
- [ ] The author can focus an orphaned mark and click any statement on the page
      to move the mark there.
- [ ] An orphaned mark has a secondary, danger-colored trash icon button with
      the title "Remove" and the aria label
      `Remove orphaned mark on statement
      "<statement text>"`, which
      discards the mark.
- [ ] Discarding an orphaned mark shows an undo toast for a few seconds, and the
      undo puts the mark back.

## Server

- [ ] `deno task chart:serve` starts a server bound to `127.0.0.1`.
- [ ] `POST /<mission>/marks` adds, relabels, or removes a mark in
      `missions/<mission>.chart.json`.
- [ ] `POST /<mission>/regenerate` rewrites the derived content of
      `missions/<mission>.chart.json`, keeps its marks, and returns the orphaned
      marks.
- [ ] A request for a name outside missions 1 to 6 is rejected, and nothing is
      written.
- [ ] The server writes a temporary file and renames it, so a stop mid-write
      leaves the old JSON.

## Tests

- [ ] A golden test compares the derived JSON of each of missions 1 to 6 with a
      stored copy, in the style of `lib/thread-graph.test.ts`.
- [ ] A marks round trip test adds a mark through the server and reads it back
      from the JSON.
- [ ] An orphan test removes a statement and finds the mark listed as orphaned.
- [ ] A server write test checks the path restriction and the rename.
- [ ] The tests run with `deno test` and the permissions each file needs.
