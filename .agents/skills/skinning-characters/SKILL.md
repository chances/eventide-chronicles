---
name: skinning-characters
description: Use when changing how a Vice City character looks, such as repainting or retexturing the player, IGMERC, or any ped, adding a new character model, importing painted PNGs into a TXD, slicing a composite mockup sheet into textures, installing skins into the game, or when a skin shows white, untextured, or unchanged in game.
---

# Skinning Characters

## Overview

A character is two files in `gta3.img`. The `.dff` holds the mesh and names the textures it uses. The `.txd` holds those textures. A retexture changes only the `.txd`, and its texture names must match what the `.dff` asks for. `deno task install` ends with `deno task install:skins`, which installs every model in `skins/`.

Read [visual-identity.md](../../../docs/visual-identity.md) before you paint. Colors come from [palette.csv](../../../docs/palette.csv). The scripts use `@cross/image`, `@std/cli`, `@std/csv`, `dxtn`, and `rw-parser-ng` from `deno.json`. No package writes a TXD or edits `gta3.img`, so `skin-format.ts` and `img.ts` cover only those two formats. Add a package before you add a helper.

## Kinds of Character

| Kind | Files in `gta3.img` | How the game uses it |
|---|---|---|
| Player outfits | `player`, `player2` to `player9`, `play10` to `play12` | `player.txd` is overridden by `models/generic/player.bmp` while that file exists. This install has it. |
| Special characters | `IGxxx` in-game, `CSxxx` cutscene, `chef` | Loaded by name with `Char.Undress` or `Streaming.LoadSpecialCharacter`. None is in `default.ide`. The `Skin` thread uses `IGMERC`, `IGMERC2`, and `CHEF`. |
| Ordinary peds | `wmyri` and the rest of the `peds` section in `default.ide` | Spawned by model id. The IDE row names the `.dff` and `.txd`. |

A character seen in play and in a cutscene has two models, such as `IGMerc` and `CSMerc`. Reskin both. A new model name works as a special character. It needs both files and a name of at most 7 characters, because Vice City script strings hold 7.

## Process

1. **Extract.** `deno task extract-skins <Name>` writes `skins/<Name>.dff`, `skins/<Name>.txd`, and one `skins/<Name>_<texture>.png` per texture.
2. **Paint the PNG.** Keep the same size. Both sides must be a power of two. Save RGB or RGBA. Any pixel with alpha below 255 makes the texture DXT3, which is twice the size.
3. **Import.** `deno task import-skin <Name> skins/<Name>_<texture>.png [...]` builds `skins/<Name>.txd` with a full mip chain. It removes the `<Name>_` prefix to get the texture name. It stops when the `.dff` never asks for a name. It overwrites the extracted TXD, and `extract-skins` restores it.
4. **Install.** Close the game. `deno task install:skins [<name> ...] [--dry-run]` installs each `skins/*.dff` and `skins/*.txd`. Use `--dry-run` first to see what changes.
5. **Wire the script.** `Char.Undress($scplayer, 'NAME')`, `Streaming.LoadAllModelsNow`, then `Char.Dress($scplayer)`. A retexture needs no script change.
6. **Ask the user to play it.** Report what the scripts printed. The user decides whether the skin is right.

## Slicing a Composite Sheet

A sheet is one image that holds several textures, such as `skins/All Skins.jpg` with its five outfit mockups. Slice it into one PNG per texture, then pack them into one TXD. No JSR or npm package slices a sheet without native code or a cloud service, so `scripts/sheet.ts` adds only the edge search to `@cross/image` crop and resize.

1. **Look at the sheet.** The viewer scales large images, so multiply a viewed coordinate by the scale it reports. Treat it as a rough guess only.
2. **Measure each side.** `deno task slice-sheet edges <sheet> <x0> <y0> <x1> <y1>` lists the strongest cuts in a window. A cut is the first pixel after a brightness step, so a panel spanning pixels `s` to `e` has cuts at `s` and `e + 1`, and its width is the difference. Use a thin window, 30 to 50 pixels wide, that stays inside the span of the panel. Its strongest cut is the border, and weaker cuts are texture detail. Labels and backgrounds that touch a wide window add false cuts.
3. **Write the manifest.** `skins/<set>.csv` has the columns `name,x,y,width,height` in sheet pixels. Name each row after its label, in lowercase with underscores, such as `scraped_gray_tank`.
4. **Cut.** `deno task slice-sheet cut <sheet> skins/<set>.csv --size 512` writes `dist/<set>/<name>.png`. Each tile is scaled to a square, so a tile that is not square is stretched. `512` is the largest power of two that fits the smallest panel. `1024` works for sources of at least that size.
5. **Check every slice.** Open each PNG. No background, label, or neighbor may show at an edge.
6. **Pack.** `deno task import-skin <set> dist/<set>/*.png` writes `skins/<set>.txd` with one texture per file, named after the file.

`dist/` holds every folder staged for installation, and Git ignores it. `deno task clean` removes it. A build to test is a folder under `dist/builds/` that holds one `.txd`, and `deno task install:skins --from dist/builds/<name>` installs it.

A panel that runs off the edge of the sheet stays cut. In `All Skins.jpg`, panels J and K lose their top rows. A `<set>.txd` with no `<set>.dff` is skipped with a warning by `install:skins`. Add a `.dff` that asks for these texture names to install it.

## What `install:skins` Does

| Input in `skins/` | Result |
|---|---|
| A name that `gta3.dir` has | Replaces the entry. Every entry with that name changes, because `chef.dff` appears twice. |
| A lone `.txd` | A retexture. The `.dff` comes from the archive for the name check. |
| A new name with both files | Adds two entries to `gta3.dir`. |
| A new name with one file | Skipped with a warning. |
| A file identical to the game's copy | Skipped, so every install is safe. |
| A `.dff` that asks for a texture the `.txd` lacks | Stops before any write. |

Files are appended to `gta3.img`, and an earlier install's slot is reused when the data fits. The first write saves `gta3.dir` as `gta3.dir.eventide-bak`. Copy it over `gta3.dir` to undo every install. Installing `player.txd` prints a warning about `player.bmp`.

## Quick Reference

| Symptom | Check |
|---|---|
| `asks for texture X, and Y.txd has none` | The PNG name differs from the `.dff` texture name. Rename the PNG. |
| `is 300x200. Vice City needs power-of-two sides.` | Resize the PNG to 256x256, 128x128, or similar. |
| `new model with a name over 7 characters` | Rename the files to 7 characters or fewer. |
| `Set VC in .env` | The install and extract tasks read `VC` from `.env`. |
| Default player skin unchanged | `models/generic/player.bmp` overrides `player.txd`. |

`deno test --allow-read --allow-env scripts/skin-format.test.ts` checks the TXD writer against the stock `IGMerc.txd` and the archive logic.

## Common Mistakes

| Excuse | Reality |
|---|---|
| "Edit `gta3.img` by hand, it is faster." | The script keeps a `gta3.dir` backup. A hand edit has no undo. |
| "The `.txd` in `skins/` is the game's copy." | Run `install:skins`. The game reads the archive, not `skins/`. |
| "Skip the cutscene model." | `CSxxx` is a separate model. The cutscene shows the old skin. |

A new model name has not been run in the game. The loader's rule comes from the GTAMods note on `LOAD_SPECIAL_CHARACTER`, that a special character needs no IDE entry. Generated `.dff` and `.txd` files stay out of Git by [skins/.gitignore](../../../skins/.gitignore). The painted PNGs are tracked.
