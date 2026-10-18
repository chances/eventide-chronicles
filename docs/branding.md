# Branding

This document defines how The Eventide Chronicles presents itself: its name, positioning, voice, style rules, and legal notices. Story content lives in [lore.md](lore.md) and its ledger, [lore.csv](lore.csv).

Status: Draft. Items marked **Open** are pending decisions listed under [Open Items](#open-items).

## Project Identity

| Element | Value |
| --- | --- |
| Title | The Eventide Chronicles |
| Episode number | None. The title carries no episode number. |
| Form | Total conversion mod for Grand Theft Auto: Vice City |
| Relationship to source | Alternate universe companion to Book 2 of the Enbenite series |
| Visual identity | Palette defined in [Color Story](#color-story). **Open**: no logo, title treatment, or typefaces exist yet |

The title "The Eventide Chronicles: Episode 2 - Miami" is retired. It was inaccurate, and the README now uses the plain title.

## Positioning

The Eventide Chronicles is an unofficial fan project. It takes Book 2 of the Enbenite series as its starting world, then branches into an alternate universe with new canon of its own. The mod is not a faithful retelling. It is a companion that answers to the book where the two agree and departs from it where the mod needs to.

The Enbenite series is named for an imaginary mineral.

## Audience

The primary audience is contributors and modders: people who write missions, dialogue, scripts, and assets for the mod. Every document in `docs/` exists so that a contributor can make a decision without asking the author.

Players are a secondary audience. Player-facing copy will be defined when distribution is settled (see [Distribution](#distribution)).

## Brand Personality

If The Eventide Chronicles were a person, it would be a serious, unsettling narrator who tells a hard story carefully, does not explain itself, and does not trust its own account of events.

## Voice Attributes

Each attribute has a practical meaning, a common misreading to avoid, and an example. The examples are drafts for contributors to test against, not final copy.

**Grim**
- **We are**: direct about loss, violence, and consequence. The story treats its stakes as real.
- **We are not**: gratuitous. Dark events are stated plainly and are not dwelt on for effect.
- **This sounds like**: "The boat did not come back for him."
- **This does NOT sound like**: "Wow, that got dark fast!"

**Restrained**
- **We are**: economical. Narration states what happened and leaves the feeling to the player.
- **We are not**: cold. Restraint does not mean the narration lacks care for its characters.
- **This sounds like**: "Her hands were steady. Nobody asked why."
- **This does NOT sound like**: "She felt a wave of unimaginable sorrow wash over her."

**Unreliable**
- **We are**: willing to let a narrator be wrong, evasive, or self-serving. The player is expected to notice.
- **We are not**: confusing for its own sake. Each unreliable account has a discoverable truth or a clear reason it is false.
- **This sounds like**: a narrator who insists on one version of events while another character's line contradicts it.
- **This does NOT sound like**: a narrator whose account is wrong for no reason the player can find.

## Tone

Tone adapts to context while the voice above stays fixed.

- **Dark comedy**: comedy in this project comes from the story itself, from characters whose plans collapse in ways the reader can see coming. It is never announced. The narration does not laugh at itself, and the player is expected to find the funny things. Characters may laugh at happenstance, and the line between comedy and tragedy stays thin.
- **System text** (menus, prompts, help): the grim register applies here too. No humor is planned for system text.

## Narration and Dialogue Style

**Open.** The writing rules for in-game narration and dialogue differ, and they will be defined separately after the grilling of the lore and brand is complete. Until then, contributors should apply the voice attributes above to both and flag any line that feels out of place for revision.

## Style Rules

These rules apply to every document, comment, and string in the project.

| Rule | Requirement |
| --- | --- |
| Spelling | US English |
| Commas | Oxford comma |
| Headings | Title case for every heading |
| Dashes | No em dashes |
| Tropes | Every named TV Tropes trope links to its tvtropes.org page, verified before it is written |
| Tables | Tabular data goes in a sibling CSV. Each document names its CSV, and each CSV names its document. |

## Terminology

| Term | Meaning |
| --- | --- |
| The Eventide Chronicles | The mod. Use the full title on first mention. |
| Book 2 | "Turning Darkness into Light" by Libby Shimmz, the source work. Always name the book on first mention in a document. |
| Enbenite series | The book series named for an imaginary mineral. |
| Book canon | Material defined by Book 2 and not contradicted by the mod. |
| Mod canon | Material the mod defines. It takes precedence over Book 2 in any conflict. |
| Departure | A place where mod canon contradicts Book 2. Each departure is logged in [lore.csv](lore.csv). |
| Open ground | Parts of Book 2 that were never written. The mod defines them as mod canon. |
| Open | A status for material not yet decided. |

Do not use "Episode 2 - Miami" or "Episode 2" in any document or string.

## Visual Identity

The palette is defined under [Color Story](#color-story). **Open.** No logo, title treatment, or typefaces have been defined. The project currently relies on the game's own interface. This section should be revised once visual assets exist.

### Color Story

The palette is anchored on eventide, the hour after sunset. A cool indigo-black base holds a few fully saturated accents. It applies to every project surface. Token values are in [palette.csv](palette.csv).

**Base.** Dark is the brand theme. The base is indigo-black with off-white text. The light theme keeps the same hues on a warm off-white base, with darker accents so each pair meets the contrast bar. Base and text colors never change with the mood.

**Official Documents.** Testing and engineering documents use a neutral gray-black base with no indigo tint, in both themes. They keep the mood accents and the status colors. The `official` tokens in [palette.csv](palette.csv) replace the base tokens for these documents.

**Moods.** A mood swaps only the primary and secondary accents. Each mood belongs to a time of day in the game.

- **Ember**: orange primary and violet secondary. Dusk. It is the default mood for static surfaces such as documents, test plans, and the README.
- **Cold Twilight**: electric blue primary and magenta secondary. Night.
- **Gold**: gold primary and pale gold secondary. Dawn and full day.

**Status Colors.** Pass is vivid teal-green and fail is vivid red-orange. They are the same in every mood. The two colors are close in lightness, so a status always carries its word or label as well.

**Progress.** The progress fill uses the mood's primary accent, because it counts recorded cases of both results.

**Contrast.** Every pair meets WCAG 2.1 AA: 4.5:1 for text and 3:1 for graphics. The `contrast_on_base` column in [palette.csv](palette.csv) lists each ratio against its theme's base.

## Distribution

Publishing targets and release requirements live in [publish.md](publish.md).

## Legal and Credits

### Disclaimer

Use this notice in the README, release pages, and any mod site listing:

> The Eventide Chronicles is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Rockstar Games or Take-Two Interactive Software, Inc. Grand Theft Auto and Vice City are trademarks of Take-Two Interactive Software, Inc.

### Credits

- **Book 2**: "Turning Darkness into Light" by Libby Shimmz.
- **Upstream repository**: created by Libby Shimmz (GitHub account josietrent, linked site libbyshimmz.com).

### License

The repository is licensed under the GNU General Public License v3.0 (GPL-3.0). See the LICENSE file in the repository root.

## Open Items

1. Visual identity: logo, title treatment, and typefaces.
2. Narration and dialogue style: writing rules for each, to be defined after the grilling.
3. Book 2 text: required before the mod-specific story sections of [lore.md](lore.md) can be completed.
