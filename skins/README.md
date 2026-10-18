---
audience: [ai, humans]
---

# Skins

This folder holds the source art and manifests for the character skins. The `.dff` and `.txd` files here are game assets, so Git ignores them.

## Files

- `All Skins.jpg` is the composite mockup sheet of the outfits.
- `outfits.csv` lists each outfit's name and its crop box on the sheet, as `name,slot,x,y,width,height`. The `slot` column names the stock model each outfit replaces.
- `player.dff` to `player5.dff`, their `.txd` files, and `player.bmp` are the generated outfit slots, `IGMerc` copies with each outfit's texture.
- `striped_utility.csv` and `scarred_leather.csv` list the textures of one build each, as input to `import-skin`.
- `IGMerc.dff`, `IGMerc.txd`, and `IGMerc_igmerc.png` are the stock player model, extracted from `gta3.img`.
- `mockups/` holds the concept art.

## Tasks

- `deno task extract-skins [name ...]` copies a model out of `gta3.img` and decodes its textures to PNG.
- `deno task slice-sheet` cuts the sheet into one PNG per outfit in `dist/`.
- `deno task import-skin` packs PNGs into a TXD.
- `deno task install:skins [name ...] [--dry-run]` installs every `.dff` and `.txd` here into `gta3.img`.
- `deno task clean` removes `dist/`.

Use the [skinning-characters](../.agents/skills/skinning-characters/SKILL.md) skill before you change a character's look.
