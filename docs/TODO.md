# TODO

Open decisions and unfinished work that have no other home. Each item states what the scripts do now and what is still undecided.

## Shop Robbery Tutorial

**Open.** Decide whether the mod teaches players to rob shops at gunpoint.

- Aiming at the jewelry store clerk starts a robbery. The player earns $50 each second, with a sound and the big text `+$50`. No text says a robbery has started.
- The clerk calls the cops after $500 (10 seconds), or when the player stops aiming. The wanted level is set to 2 stars, and the help text "He called the cops! Lose the heat!" appears.
- Nothing else explains robbing shops. The game's text file has no robbery entry.
- If the mod teaches it, a help text on the first aim at the clerk can carry the lesson. System text stays grim, as [branding.md](branding.md) requires.
- If the mod does not teach it, players find the robbery by accident, as happened in a playtest.

## Protagonist Skin and Mesh

**Open.** The `Skin` thread dresses the player in the `IGMERC` model at six locations. See [visual-identity.md](visual-identity.md).

- Replace the skin with the Mercedes character's skin.
- Remodel the character mesh. The clothes do not fit it now.
- The mood accent on her outfit waits for the remodel.

## Visual Identity Assets

**Open.** Work after the first two priorities in [visual-identity-assets.csv](visual-identity-assets.csv).

- Key art, with an empty street in fog first.
- Title mark, which waits for the Enbenite mineral (L008).
- Signs and billboards with unstable text, and vehicle liveries.
- The custom `timecyc` data file, one grade per mood.
- Camera shake and FOV blur, within the effect limits in [visual-identity.md](visual-identity.md).
- Script support for the mood, the coherence stage, and the ini switch that reduces effects.
