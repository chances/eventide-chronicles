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

- [x] Each conflict names one of the pairs `mission-thread`, `thread-thread`, or
      `trigger-mission`.
- [x] Each conflict names its `global`. Each `mission-thread` and
      `thread-thread` conflict has two access sites, each with file, line, and
      access kind, and a `mission-thread` conflict has at least one write.
- [x] A `trigger-mission` conflict appears for a trigger that starts a mission
      without testing `$ONMISSION`, and has one access site, the launch call.
- [x] No script of kind `mission` is on the thread side of a conflict.
- [x] A thread that touches no global of the mission produces no conflict.

## State Machine

- [x] A mission with no marks is one state.
- [x] A wait statement never creates a state.
- [x] Each mark begins one state, and the state carries the mark's label when it
      has one.
- [x] Guards and transitions between marked states come from the statement graph
      of `tools/cfg` (`statements.ts`), imported by `tools/chart` by package
      name. The `tools/cfg` command prints that graph with its `--statements`
      flag, and without the flag it prints the same blocks as before.
- [x] Each guard is Gherkin English on separate lines from `./Phrasebook.csv`:
      each `When` line uses the active phrase of its condition, each `And` line
      uses a nominal phrase, a negated condition uses its opposite phrase, a
      chain is negated and minimized by `logi.js`, and each alternative of the
      result is its own `When` line.
- [x] A command's arguments follow its phrase with the library parameter names
      before their values, points grouped without x, y, and z names, radii
      grouped as `radius (...)`, and the instance argument dropped.
- [x] A condition with no Phrasebook entry shows its source text in the guard
      and is listed in `errors` with `kind` `unphrased` and the expression.
- [x] A global whose every write is 0, 1, `true`, or `false` is a boolean flag:
      `$V == 1` is the flag, `$V == 0` is its negation, and the Phrasebook has
      one row keyed `$V`.
- [x] A mission with N marks has N plus one states, and the start state is
      dropped when the first mark sits on the first statement.
- [x] A statement reached from two states is listed in `errors` with severity
      `error`, and one reached only through `gosub` calls with severity
      `warning`.

## Behavior

- [x] Effect traces come from `tools/flow-model`.
- [x] Each trace stores its `script`, its `lock` (`free` or `held`), its
      `bound`, a `cut` flag that is true when the run hit the bound before the
      script ended, and its `effects` as an ordered array of strings.
- [x] The chart has no top-level `traceBound` in the schema, the tool, the
      tests, or the `missions/*.chart.json` files.
- [x] Each mission has traces of its trigger with the lock free and with the
      lock held, and traces of its mission script with the lock held.
- [x] Triggers run at bound 12. Mission scripts run at bound 24, measured for
      each mission with the `tools/flow-model` library before the bound is kept.
      The JSON stores only each trace's bound, not the measured counts.
- [x] A run that exceeds the memory cap or the timeout stops with a message that
      names the cap that fired.
- [x] Heavy runs go through the capped runner, and `decide +kernel` appears
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
- [ ] A page shows each entry of `errors` at its statement, as an error or as a
      warning by severity, with the states that reach it. A warning reminds the
      author to refactor the shared subroutine into a function.
- [ ] A page shows each `unphrased` entry of `errors` as an error with a modal
      dialog where the author types the phrase, and the dialog offers the
      server's suggested phrase.
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
- [ ] `GET /phrases/suggest?expression=...` returns a `compromise` suggestion
      for the opposite column and leaves the active column blank, and
      `POST /phrases` adds or edits one row of `./Phrasebook.csv`.
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
