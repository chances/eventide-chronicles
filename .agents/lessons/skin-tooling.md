---
audience: [ai, human]
---
# Skin Tooling

Follow these rules when you change the skin scripts in `scripts/` or the `skinning-characters` skill. The patterns are in [skin-tooling.csv](skin-tooling.csv).

## Rules for Editing

1. Search JSR, then npm, before you write any decoder, encoder, parser, or resizer. Read the `deno-guidance` skill first, and add each package with `deno add`.
2. Reuse the readers that already exist. `img.ts` and `extract-skins.ts` must share one directory reader.
3. A package that will not load is diagnosed or swapped. It is never replaced by hand-written code.
4. Measure the panels of a sheet with `deno task slice-sheet edges`. Never trust coordinates read from a scaled preview.
5. Run `deno task install:skins --dry-run` against the real game folder before you report on the installer.
6. Extract probe files with `--out dist/probe`, not into `skins/`, and check `git status` before you finish.
7. A sheet texture fits the model it was painted for. Replace both files of a stock clothing-store slot: `import-skin <slot> <png> --base <Model>` copies the mesh the texture was painted for, so the slot's `.dff` and `.txd` change together. Replacing only the `.txd` leaves a mesh with the wrong layout.
8. The `player` slot also needs `models/generic/player.bmp`. `import-skin player` writes `skins/player.bmp` and `install:skins` installs it, because the game reads the bitmap and ignores `player.txd`.

## What Counts as Done

Report the output of each command. Working is the user's call, and the game has the last word on a skin.
