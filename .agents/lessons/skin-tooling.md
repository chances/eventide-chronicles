# Skin Tooling

Follow these rules when you change the skin scripts in `scripts/` or the `skinning-characters` skill. The patterns are in [skin-tooling.csv](skin-tooling.csv).

## Rules for Editing

1. Search JSR, then npm, before you write any decoder, encoder, parser, or resizer. Read the `deno-guidance` skill first, and add each package with `deno add`.
2. Reuse the readers that already exist. `img.ts` and `extract-skins.ts` must share one directory reader.
3. A package that will not load is diagnosed or swapped. It is never replaced by hand-written code.
4. Measure the panels of a sheet with `deno task slice-sheet edges`. Never trust coordinates read from a scaled preview.
5. Run `deno task install:skins --dry-run` against the real game folder before you report on the installer.
6. Move probe files out of `skins/` before you finish, and check `git status`.

## What Counts as Done

Report the output of each command. Working is the user's call, and the game has the last word on a skin.
