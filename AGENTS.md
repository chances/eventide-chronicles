# Agent Guidance

These rules apply to every agent working in this repository.

Agents are programs. They cannot express grief, sorrow, regret, or remorse, and
they do not apologize with feeling. State the error, the fix, and the verified
result.

## Project Summary

This repo is The Eventide Chronicles, a total Conversion mod for Grand Theft
Auto: Vice City.

## Style

- Use US English and the Oxford comma.
- Use title case for every heading.
- Document titles name the document only, as in "Branding" or "Lore." Do not
  prefix them with "The Eventide Chronicles:".
- Do not use em dashes in any text.
- Do not use "Episode 2" or "Episode 2 - Miami" in any document or string. The
  title is "The Eventide Chronicles."

## Canon

- The mod's canon wins conflicts with Book 2 of the Enbenite series.
- Record each departure from Book 2 in the ledger with a departure note.
- Record new canon in the ledger as Mod. Record material still undecided as
  Open.
- Do not treat the Eventide-III repository as canon.

## Tropes

- Every TV Tropes trope named in any document links to its tvtropes.org page.
- Verify each link before writing it. A link is verified when its page loads and
  its title matches the trope.

## Documentation

- Use surgical edits for existing documents and scripts. Do not overwrite a file
  with `cat`, a heredoc, or a whole-file write when the requested change can be
  made by replacing a specific text range.
- Use the `writing-documentation` skill before writing or editing a code
  comment, a README, a design or reference document, or this file. Comments and
  documents state the current fact or constraint, never the history of how it
  came to be.
- Every TypeScript module opens with a `/** @module ... */` block that states
  what the module does, as in `tools/chart/assembler.ts`. Do not use `//` lines
  for it.
- Read [docs/branding.md](docs/branding.md) and [docs/lore.md](docs/lore.md)
  before writing or editing any story text, string, or document.
- Check the ledger, [docs/lore.csv](docs/lore.csv), before defining any story
  element. Use the status it records. Do not contradict a Book entry without
  adding a departure note.
- Publishing targets and release instructions go in
  [docs/publish.md](docs/publish.md). Do not put them in the branding or lore
  documents.
- The `/breakdown-*` skills write a named implementation plan to
  `.agents/plans/<name>.md` and its acceptance criteria to the sibling
  `.agents/plans/<name>.ac.md`.
- The `/breakdown-*` skills name each work item with a readable slug in Title
  Case, such as "Schema," "Marks," or "Launch Sites." Never use a two-character
  code such as E1 or S2 in a heading, table, diagram, or cross-reference.
- CSV files are for tabular data sets. Record a single bug in a Markdown
  document; when one bug document tracks multiple bugs, use a sibling CSV for
  the tabular records.
- Read [docs/visual-identity.md](docs/visual-identity.md) before making any art,
  font, color, or HUD change. Colors come from
  [docs/palette.csv](docs/palette.csv).
- The hidden premise lives only in [docs/spoilers.md](docs/spoilers.md). Do not
  state or hint at it in any other document, in release art, or in any
  player-facing string. Link to the spoiler document instead.
- Design specimens, such as typeface and color comparisons, are saved as HTML
  pages in [docs/specimens](docs/specimens). Show a visual choice as a specimen
  before asking the user to pick.

## Test Plans

Read [.agents/testing/test-plans.md](.agents/testing/test-plans.md) before you
write, edit, or preview a test plan, or change the shared test-plan stylesheet
and scripts in `.agents/testing`.

## Scripting

This is pre-alpha software. While it's under active iteration, no change needs
to be backward-compatible with earlier builds, saves, or scripts.

- Use the `sanny-guidance` skill before writing, editing, or reviewing any Sanny
  Builder script.
- Look up every command in the Sanny Builder Library before using it, and look
  up every syntax form (conditions, loops, variables) in the Sanny Builder docs.
  The skill lists the lookup tools.
- Read
  [.agents/lessons/mission-script-safety.md](.agents/lessons/mission-script-safety.md)
  before you edit a mission script or a looping thread.
- Use the [debug-missions](.agents/skills/debug-missions/SKILL.md) skill before
  you debug a script crash, hang, or hazard in `main.txt`.
- Read [.agents/lessons/sanny-variables.md](.agents/lessons/sanny-variables.md)
  before you use a local variable, a subroutine result, or a boolean in a
  script.

### Anti-Patterns

- Use structured control flow (if/else, while loops, function calls) instead of
  gotos when refactoring or adding new features.

## Script Architecture

- `main.txt` is UTF-8 and holds four-byte emoji. Keep the encoding when a
  command rewrites it.
- Read [.agents/docs/architecture.md](.agents/docs/architecture.md) before you
  change `main.txt`, an include, a thread, a mission script, the build or
  install tasks, the clothing stores, a skin, or a GXT string.

### Debugging

- Read [.agents/docs/debugging.md](.agents/docs/debugging.md) before you debug a
  script crash or run a static tool over the scripts.
- `deno task --cwd tools/cfg start ../../main.txt <label>` prints the
  control-flow blocks reachable from a label.
- `deno task --cwd tools/thread-graph start ../../main.txt --vars '$ONMISSION' --outline Star,HOT`
  prints the thread and mission graph as JSON.
- `deno task --cwd tools/flow-model capped <memoryMB> <timeoutSeconds> <command> [args...]`
  runs a command under a hard memory limit and timeout. Run any heavy trace
  enumeration through it.
- `deno task chart <mission> [--missions <dir>] [--entry <file>] [--cleo-dir <dir>]...`
  (`tools/chart`) rewrites the derived content of
  `missions/<mission>.chart.json`, keeps its marks, and lists orphaned marks.
