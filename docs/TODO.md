# Todo List

Open decisions and unfinished work that have no other home. Each item states what the scripts do now and what is still undecided.

## 🔫🛒 Shop Robbery Tutorial

**Open.** Decide whether the mod teaches players to rob shops at gunpoint.

- Aiming at the jewelry store clerk starts a robbery. The player earns $50 each second, with a sound and the big text `+$50`. No text says a robbery has started.
- The clerk calls the cops after $500 (10 seconds), or when the player stops aiming. The wanted level is set to 2 stars, and the help text "He called the cops! Lose the heat!" appears.
- Nothing else explains robbing shops. The game's text file has no robbery entry.
- If the mod teaches it, a help text on the first aim at the clerk can carry the lesson. System text stays grim, as [branding.md](branding.md) requires.
- If the mod does not teach it, players find the robbery by accident, as happened in a playtest.

## 💳 Credit Cards

- Pedestrians and the public also carry credit cards in addition to cash. Credit cards can be used at ATMs and payphones.

## 💅 Visual Identity Assets

**Open.** Work after the first two priorities in [visual-identity-assets.csv](visual-identity-assets.csv).

- Key art, with an empty street in fog first.
- Title mark, which waits for the Enbenite mineral (L008).
- Signs and billboards with unstable text, and vehicle liveries.
- The custom `timecyc` data file, one grade per mood.
- Camera shake and FOV blur, within the effect limits in [visual-identity.md](visual-identity.md).
- Script support for the mood, the coherence stage, and the ini switch that reduces effects.

### Skins and Character Meshes

**Open.** The `Skin` thread dresses the player in the `IGMERC` model at six locations. See [visual-identity.md](visual-identity.md).

- Replace the skin with the Mercedes character's skin.
- Remodel the character mesh. The clothes do not fit it now.
- The mood accent on her outfit waits for the remodel.

## 📚 Plot

**Open.** When the player gets to the hotel, a cutscene shows her looking for her mother.

- Is the player wanted when she arrives?
- Is the player in a car when she arrives?

## 🔫 Weapons

**Open.** Replace the baseball bat with an axe-like "large stick".

## 📻 Radio

### Flash FM

**Open.**

#### Additions

- "Tubthumping" by Chumbawamba.

## Flashback FM

**Open.**

#### Additions

- "Firestarter" by The Prodigy

## Electroshock FM

**Open.**

#### Additions

- "Narayan" by The Prodigy
- "Serial Thrilla" by The Prodigy
- "Kid A" by Radiohead
- "Ageispolis" by Aphex Twin
- "Halcyon On + On" by Orbital
- "1999 (Kaycee Remix)" by Binary Finary
- "All In" by Flying Lotus
- "Ecstasy" by ATB
- "Everytime We Touch" by Cascada
- "Around the World" by ATC
- "Technologic" by Daft Punk
- "Heaven" by DJ Sammy
- "Better Off Alone" by Alice DJ
- "Castles in the Sky" by Ian Van Dahl
- "Cafe Del Mar (Three ‘n One Radio Edit)" by Energy 52
- "Children" by Robert Miles
- "I Know It's You" by The Crystal Method
- "Hold My Hand (Innervisions Orchestra Remix)" by UNKLE

## 🖋💬 Script Ideas

**Open.** A line for the player when she picks up the cell phone:

### Dialogue

> Hey, cool! A cell phone! I can call my mother! Are there unlimited minutes on this thing or what? (cell phone beeps erratically)

## 🥅 Mission Ideas

**Open.**

- "Are You There God? It's Me, Toni"
