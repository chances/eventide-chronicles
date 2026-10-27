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

## 📞 Cellphone

**Open.** Two dialed numbers wait for decisions. Until they are built, `CellPhone_DialDone` in `lib/threads/cellphone.txt` answers both with the busy tone. The rest of the phone is in the [cell-phone plan](../.agents/plans/cell-phone.md).

### Oakdale Rental, 555-7653

- A recorded message plays about the apartment. Between 9 am and 5 pm, the player is prompted to buy it if funds allow. Outside those hours, or when the player already owns it, the message plays only.
- Which existing sale property the number refers to is undecided. `lib/init.txt` lists six `Pickup.CreateForSaleProperty` pickups, and Oakdale is not among them. The buy prompt waits on this.
- The recording itself is not written.

### Zit Hotline, 555-0100

- A pager-style text message names the track now playing on the radio, the way the GTA III pager does. When the player is not driving or the radio is off, the busy tone plays instead.
- The base game cannot read the radio state or the current station. `GET_RADIO_CHANNEL` (`051E`) is unsupported in Vice City, and the only setter is `Audio.SetRadioChannel` (`041E`). See [README.md](../plugins/cell-phone/README.md).
- The station-and-time track table does not exist. What the text says until it does is undecided.

## 💅 Visual Identity Assets

**Open.** Work after the first two priorities in [visual-identity-assets.csv](visual-identity-assets.csv).

- Key art, with an empty street in fog first.
- Title mark, which waits for the Enbenite mineral (L008).
- Signs and billboards with unstable text, and vehicle liveries.
- Retexture the Oakdale "To Let" sign. Its number has eight digits, but the cell phone accepts seven. New number: 555-7653
- Remodel the brick cell phone in the game's models. Out of scope for the cell-phone plugin, whose phone face is drawn on the HUD. See the [cell-phone plan](../.agents/plans/cell-phone.md).
- The custom `timecyc` data file, one grade per mood.
- Camera shake and FOV blur, within the effect limits in [visual-identity.md](visual-identity.md).
- Script support for the mood, the coherence stage, and the ini switch that reduces effects.

### Skins and Character Meshes

**Open.** `MAIN`, the `Skin` thread, and the Mystery scene dress the player in the `PLAYER` slot, which holds the default mockup outfit. See [visual-identity.md](visual-identity.md).

- Replace the skin with the Mercedes character's skin.
- Remodel the character mesh. The clothes do not fit it now.
- The mood accent on her outfit waits for the remodel.

## 📚 Plot

**Open.** When the player gets to the hotel, a cutscene shows her looking for her mother.

- Is the player wanted when she arrives?
- Is the player in a car when she arrives?

## 🔫 Weapons

**Open.** Replace the baseball bat with an axe.

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

## 🖋💬 Script Ideas

**Open.** A line for the player when she picks up the cell phone:

### Dialogue

> Hey, cool! A cell phone! I can call my mother! Are there unlimited minutes on this thing or what? (cell phone beeps erratically)

## 🥅 Mission Ideas

**Open.**

- "Are You There God? It's Me, Toni!"
- "Random Violence": The two-line stub was removed from `main.txt`: `:RandomViolence` followed by `script_name 'Random'`.

## 🧱 Script Split Leftovers

- Threads that mission 0 does not start, such as `Star`, `Police`, `Cell`, and `PACKAGE`, still live in `main.txt`.
- `DEFINE MISSION 10 AT @Heaven` has no `:Heaven` label, and `goto @Intro_1455` in `Intro` has no `:Intro_1455` label. `main.scm` builds with both.

## 🧵 CLEO Threads

**Open.** Port a mission to a CLEO thread only when a feature needs it, such as the hotel cutscene or a radio track. The [VC CLEO 2.2.0 opcode list](https://raw.githubusercontent.com/cleolibrary/III.VC.CLEO/master/source/CLEO_SDK/scm.txt) has `0A92` create_custom_thread and no `0A94` start_custom_mission, so a CLEO mission is a plain thread without the engine's death and bust check. Mission scripts are in `missions/`, and mission 0's threads are in `lib/threads/`.

- Confirm the `VC.CLEO.asi` version in the game folder (dated 2025-12-30). `0A92` must exist in that build.
- Pilot candidates are `Fairy` (78 lines, 5 globals, no outside jump) and `Endgame` (117 lines, 6 globals, no outside jump). `Hotel` waits for a replacement for its jump to `Boss`.
- The thread polls `Player.IsPlaying($PLAYER1)` and runs its fail path itself, clears `$ONMISSION`, removes its own pickups and blips, and ends with `end_custom_thread`.
- A jump into `main.scm` such as `Police` becomes a global flag or `create_custom_thread`.
- The thread includes `lib/alloc.txt` so each global keeps its offset.
- `deno task build` compiles only `main.txt`. A CLEO script needs `{$CLEO .cs}` and a copy into the game's `CLEO` folder, added to the existing `deno task install`.
- Compare `scrlog.log` for a death and a bust case with the `debug-missions` skill before accepting the port.
