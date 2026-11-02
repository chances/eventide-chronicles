# Visual Identity

This document defines how The Eventide Chronicles looks: its type, its moods, how the world breaks down, and the order in which assets are made. The palette is in [palette.csv](palette.csv). Brand voice is in [branding.md](branding.md). Story decisions are in [lore.md](lore.md) and [lore.csv](lore.csv).

Contributors who make art, fonts, or scripts read [spoilers.md](spoilers.md) first. It explains why the world behaves as it does. Player-facing text, release art, and store listings must not state or strongly hint at it.

Status: Draft. Items marked **Open** await the Book 2 text or a later task.

## Scope

The identity covers three surfaces.

- **In-game screens**: title cards, loading screens, the HUD, the radar, and help text.
- **Release art**: the banner, the thread header, the repository preview, and the mod icon.
- **World textures and models**: blocked-area props, signs, billboards, vehicles, and the protagonist.

Documents and test plans already follow the palette and are not part of this scope.

## Direction

The mod's own art makes a clear break from the base game's pink and teal 1980s look. The setting stays Vice City. Every custom surface uses the indigo base and the mood accents from [palette.csv](palette.csv).

## Type

The full table is [visual-identity-typefaces.csv](visual-identity-typefaces.csv).

- **Special Elite** (Apache 2.0) sets all game text: cards, subtitles, and narration. It reads as a typed case file, which suits an [Unreliable Narrator](https://tvtropes.org/pmwiki/pmwiki.php/Main/UnreliableNarrator).
- **Inter Black** (SIL OFL 1.1) sets the smallest text: HUD digits, radar and map labels, and help text. Special Elite has one weight and loses clarity at small sizes.
- Both faces are baked into font textures. Each must stay under a license that allows redistribution with a GPL-3.0 release.
- Mission title cards use the engine's own fade and pop. No custom reveal is planned.

## Moods

A mood is the player's emotional state. It swaps the primary and secondary accents and grades the world. The palette defines three moods. This section defines what each one means and how it changes.

| Mood | Time of day | Meaning |
| --- | --- | --- |
| Ember | Dusk | Resigned unease. The default. |
| Cold Twilight | Night | Dread, isolation, grief, numbness, and supernatural contact, as the scene requires. |
| Gold | Dawn and day | Relief, which may be a false sense of security. The grim tone stays. |

**Inputs.** Four inputs move the mood: mission type, free-roam actions, health and wanted level and deaths, and story beats inside a mission.

**Switching.** A scripted story beat changes the mood at once. In free roam the mood eases between palettes.

**Grading.** The mood is applied in two stages.

1. Scripts force the clock and weather, as `main.txt` already does.
2. A custom `timecyc` data file grades sky, ambient light, and fog to match [palette.csv](palette.csv). **Open**: the data file does not exist yet.

Camera shake and FOV blur are possible later refinements. They fall under the effect limits below.

**Display.** The mood is never shown. There is no meter, icon, or text for it. The clock HUD is hidden for most of the story.

## Coherence

Coherence is a second axis, separate from mood. It measures how far the world has broken from a stable state, and it rises with story progress. A calm Gold scene can still be unstable. The table is [visual-identity-coherence.csv](visual-identity-coherence.csv).

| Stage | Tells |
| --- | --- |
| Stable | None. |
| Unstable | Unstable sign and billboard text, wrong clocks, and rare unmistakable leaks. |
| Broken | The Unstable tells, more often, plus radar, number, and subtitle garbling and explicit leaks. |

The ladder is cumulative. A leak is a detail from outside the world. [spoilers.md](spoilers.md) defines the leaks.

**Effect Limits.** Two limits apply to every effect.

- No brightness or color flash is faster than 3 per second.
- An ini switch turns off shake, blur, and HUD garbling. Mood grading stays on.

## Blocked Areas

Blocked areas are physical obstacles in the world. Starfish Island is locked at the start of the game. Each obstacle is either mundane, such as a locked gate, a police line, a collapsed bridge, or fog, or unnatural, such as a shimmer or a color field. Which kind appears depends on story progress and mood. [spoilers.md](spoilers.md) explains what the Barrier stands for.

## Speaker Colors

Subtitles carry one color per speaker. The tokens are in [palette.csv](palette.csv) under the Speaker Colors section. They stay fixed in every mood, like the pass and fail colors, and each meets 4.5:1 against its theme's base.

| Speaker | Used for |
| --- | --- |
| Toni | The protagonist, Toni Mueller. |
| Boss | The Boss in the Cart and BossDie scenes. |
| Daughter | The Daughter in the bike ride. |
| Fairy | The Fairy at the start of the late arc. |
| Narrator | The opening narration, help tips, and all other help text. |

The Narrator is unreliable. Its color marks a voice the player can learn to doubt.

## Protagonist

The protagonist is Toni Mueller. The `Skin` thread and `MAIN` in `main.txt` call `Char.Undress` with the `PLAYER` model, and the `Clothes` thread gives the clothing-store outfits in the stock slots `player2`, `player3`, and `player5`, as [outfits.csv](../skins/outfits.csv) maps them. Two later tasks are in [TODO.md](TODO.md): replacing the skin with the Mercedes character's skin, and remodeling the mesh because the clothes do not fit. A mood accent on her outfit waits for the remodel.

## Key Art

The key art is dark painterly realism, mixed with graded in-engine screenshots and flat graphics that show the mod to potential players. The first piece is an empty street in fog. It must not reveal what [spoilers.md](spoilers.md) records.

Loading screens are one painted image per mood, three in total, each with a line in Special Elite.

## Title Mark

**Open.** The emblem is built from the Enbenite mineral. The mineral is Open in the ledger (L008), so the emblem waits for the Book 2 text.

## Asset Order

The full list is [visual-identity-assets.csv](visual-identity-assets.csv).

1. Protagonist skins.
2. Fonts, title cards, loading screens, and blocked-area props.
3. Everything else, tracked in [TODO.md](TODO.md).

## Open Items

1. Title mark: waits for the mineral (L008).
2. The custom `timecyc` data file.
3. Mood accent on the protagonist's outfit: waits for the mesh remodel.
