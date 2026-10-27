# Cell Phone

A CLEO plugin (`cell-phone.cleo`) and the SCM thread `lib/threads/cellphone.txt` give the player a phone. The plugin owns the state machine, the digit buffer, the timers, and the generated tones. The thread forwards keys, draws the phone with base-game sprite commands, and runs the dial effects, because mission state and the other threads live in `main.scm`. Open work is in the Cellphone section of [TODO.md](../../docs/TODO.md).

## Behavior

### Raising the Phone

- P toggles the phone up and down. The package tracker toggles on O.
- While the phone is up, player control is off and game time keeps running.
- Raising is blocked in a vehicle and during cutscenes.
- Once picked up, the phone is owned for good. It survives death and arrest.

### Typing and Dialing

- Number keys 0 to 9 type digits, Backspace deletes, and Enter dials. The call key on the HUD sinks while Enter is held. The display takes seven digits.
- Escape is not bound. It opens the pause menu as usual.
- Dialing rings for 3 seconds before the script resolves the number. The tones are in Sound Decisions below.
- The LCD shows the number or the call timer, never both. A dialed call keeps its number on screen for the first 500 ms (`timerb < 500` in `lib/threads/cellphone.txt`, which must match `kRingbackDelayMs` in `tones.h`), then the timer replaces it. The timer is `m:ss` at the right of the LCD (minutes take a second digit from 10 and stop at 99), runs in game time, and counts from the dial. An incoming call is timed from the answer.
- Any key press during a call wakes the backlight.

### Incoming Calls

- A mission script sets `$PhoneCaller` to the caller's seven digits, then calls `ring_incoming`. The phone slides up, shows the caller's number, and flashes it (400 ms on, 400 ms off). The ring lasts 20 seconds, and player control stays on.
- The help text `PHRING` names the keys: A or Tab answers, P declines. It clears when the ring ends.
- Answering connects the call. Declining or letting it ring out lowers the phone, and a mission script reads the event: `3` hung up, `4` missed, `5` declined.

### Dialed Numbers

| Number | Result |
|---|---|
| `555-8294` | A taxi spawns on a road node about 60 m away that the camera cannot see, drives to the player, slows near them, and parks within 8 m. It stays until it is wrecked or the player is 100 m away. |
| `555-7492` | A pizza moped (`#PIZZABOY`) and rider (`#HMOBE`) arrive the same way. The rider gets off, walks to the player, and takes $10 to heal them to 100 (help text `PIZZAOK`), or leaves when the player has under $10 (`PIZZANO`). The rider then gets back on and cruises off, and the pop cycle takes both. |
| `555-7653`, `555-0100` | Oakdale rental and Zit hotline are deferred. They get the busy flow below until built. |
| Any other number | The call connects and the timer runs. After 2 quiet seconds the busy tone plays for 4 seconds with the timer still running, then the call drops to number entry with the digits cleared. P ends the call at any point. |

The plugin knows nothing about numbers. It reports a finished dial with the number, and each number's handler in `CellPhone_DialDone` answers with `resolve`: 1 connected, 2 busy, 3 call over.

### Look

Sizes are in mockup pixels, from [cellphone-mockup.html](../../docs/specimens/cellphone-mockup.html). Colors come from [palette.csv](../../docs/palette.csv).

- A candy-bar phone set in 2010, modeled on the [Nokia 1280](https://wikipedia.com/wiki/Nokia_1280): speaker slot, LCD, navigation cluster, 12-key keypad. No antenna. The body is the surface color (`#17142e`), 200 wide, with 22 rounded top corners and square bottom corners.
- Cold Twilight blue trim (`#4d94ff`, 2 px) only around the speaker slot (52 by 6) and the LCD (60 tall).
- The LCD digits are sprites, not game text, because the game has no monospaced font and its text wraps. Each glyph (`0` to `9`, the dash, the colon) is a white texture rendered from Courier New, drawn on a grid of equal cells and tinted by the sprite color: Ember (`#ff7a1a`) when lit, the muted color at 18% alpha when not. The digits are left aligned with a dash after the third.
- The navigation cluster has two soft keys (24 tall, each with a 12 by 2 dash), a 76 round D-pad with four triangle arrows, an answer key (handset in the pass color `#00d9a3`), and a hang-up key (handset in the fail color `#ff4a2b`).
- The keypad is 3 by 4 pill keys, 34 tall with 8 gaps. Keys 2 to 9 carry letters (ITU E.161), key 1 the voicemail symbol, and the bottom row is `*`, `0`, `#`.
- Keys are raised rubber: a top highlight and a 4 px lip in the base color. Pressed, a key (and the D-pad) sinks 4 px into its lip, the highlight turns to shade, and a lit key's glyph glows brighter while it is held. Unlit, keys dim to 30%.
- The backlight is on when the phone is raised and goes dark 5 seconds after the last key press, or after raising if no key is pressed.
- The phone sits at the bottom-right of the HUD, clear of the radar, health, and wanted stars, with its last key row 13 px above the screen edge and the bottom cut off. Raising slides it up over 0.55 s, and lowering slides it back down.
- The sprite space is 640 by 448 with x and y at the sprite's center, so widescreen stretches x. The thread scales x by 0.75 of y for a 16:9 screen.
- The textures are rendered by `deno task render-phone` into `dist/phone/phone.txd`, and `deno task install` copies it to `<VC>\models\phone.txd`. `0390` loads it from there, and texture names stay within 7 characters.
- The in-hand brick model is out of scope. [TODO.md](../../docs/TODO.md) tracks its remodel.

## Plugin Interface

The plugin adds three opcodes. Scripts read its state through the globals `$PhoneState`, `$PhoneEvent`, and `$PhoneNumber`, which the thread mirrors from `tick` each frame. The HUD uses the base-game commands `038D` DRAW_SPRITE, `0390` LOAD_TEXTURE_DICTIONARY, and `038F` LOAD_SPRITE. The plugin has no D3D hook and no ImGui.

| Opcode | Inputs | Outputs |
|---|---|---|
| `0B40 tick` | key code, blocked flag | state, lit, animating (0 or 1), digit count, number, event |
| `0B41 ring_incoming` | none | none |
| `0B42 resolve` | result: 1 connected, 2 busy, 3 call over | none |

- Key codes: `-1` none, `0` to `9` digits, `10` Backspace, `11` dial (Enter), `12` Escape (not sent), `13` toggle (P), `14` answer (A or Tab).
- States: `0` lowered, `1` raised, `2` ringing out, `3` dialed (waiting for `resolve`), `4` ringing in, `5` connected.
- Events, one per frame: `0` none, `1` dial done, `2` answered, `3` hung up, `4` missed, `5` declined.
- `tick` runs once per frame. The script passes `blocked` as 1 in a vehicle or a cutscene, and the plugin lowers the phone while it is 1.
- `number` holds the dialed digits as an integer, and the digit count restores leading zeros.
- While ringing in, the plugin keeps the phone backlit and answers P with a decline.
- `phone_machine.h` is the state machine, header only, with time passed in so the native tests need no clock. `tones.h` holds the tone cadences and the DTMF table with no Windows includes, so the machine can derive the busy-call length from `kBusy`.

## Constraints

- The game is `gta-vc.exe` v1.0, 32-bit, so the plugin builds as Win32 (`cmake -A Win32`, run by `deno task build`). `deno task install` copies `cell-phone.cleo` into the game's `CLEO` folder, and `deno task probe` does not.
- The plugin refuses to load on a CLEO older than 2.0.0. `CLEO_GetVersion()` packs the installed v2.0.0.6 as `0x00020006`, so the check compares against `0x00020000`.
- Plugin opcodes are `0B40` to `0B42`. Upstream `scm.txt` lists `0B00` to `0B21` and `0BA2` to `0BA4` as taken and `0B40` to `0B4F` as free.
- `Tab` already answers calls in the `Cell` thread, `O` toggles the package tracker, and `Q` stays with the game's weapon switch.

## Confirmed Names

The Sanny Builder names below come from the [Vice City library data](https://raw.githubusercontent.com/sannybuilder/library/master/vc/vc.json) (`vc.json` and `enums.json`, version 0.408). Names are written in class syntax, with the opcode beside each.

| Need | Command | Opcode | Parameters and Result |
|---|---|---|---|
| Key press | `Pad.IsKeyPressed` | `05EE` | `KeyCode`, a condition |
| Player in a vehicle | `Player.IsInAnyCar` | `00E0` | `self`, a condition |
| Player control | `Player.SetControl` | `01B4` | `self`, `state`; no getter exists |
| Answering a call | `Char.SetAnsweringMobile` | `052B` | `self`, `state` |
| Time of day | `Clock.GetTimeOfDay` | `00BF` | returns `hours`, `minutes` |
| Player cash | `Player.StoreScore` | `010B` | `self`, returns `money` |
| Cash check | `Player.IsScoreGreater` | `010A` | `self`, `money`, a condition |
| Road node near a point | `Path.GetClosestCarNode` | `02C1` | `x`, `y`, `z`, returns `nodeX`, `nodeY`, `nodeZ` |
| Road node with heading | `Path.GetClosestCarNodeWithHeading` | `03D3` | `x`, `y`, `z`, returns node and `angle` |
| Spawn a car | `Car.Create` | `00A5` | `modelId`, `x`, `y`, `z`, returns `handle` |
| Spawn a rider | `Char.CreateInsideCar` | `0129` | `vehicle`, `pedType`, `modelId` |
| Drive to a point | `Car.GotoCoordinatesAccurate` | `02C2` | `self`, `x`, `y`, `z` |
| Park and stop | `Car.SetMission` with `CarMission.StopForever` | `00AF` | `self`, `carMission` (value 11) |
| Stopped check | `Car.IsStopped` | `01C1` | `self`, a condition |
| Camera check, point | `Camera.IsPointOnScreen` | `00C2` | `x`, `y`, `z`, `radius`, a condition |
| Camera check, car | `Car.IsOnScreen` | `02CA` | `self`, a condition |
| Help text | `Text.PrintHelp` | `03E5` | `key` |

## Key Codes

The `KeyCode` enum has `Num0` to `Num9` for the number row, `NumPad0` to `NumPad9` for the keypad, `Back` for Backspace, `Return` for Enter, `Escape`, and `Tab`. The repo already uses `KeyCode.Tab`, `KeyCode.O`, `KeyCode.P`, `KeyCode.G`, `KeyCode.N`, `KeyCode.M`, `KeyCode.LeftShift`, `KeyCode.F2`, and `KeyCode.F3`.

## Models

The repo uses `#TAXI` and `#CABBIE` in `lib/threads/ringu.txt`, and `#PIZZABOY` as the pizza moped in `lib/init.txt`. The pizza rider is `#HMOBE`, picked from the [Vice City ped catalog](https://claude.ai/artifact/XBWMsVjWWffD7pgb9iXtWf).

## Sound Decisions

| Sound | Source | Detail |
|---|---|---|
| Incoming ringtone | WAV from the [ringtone editor](../../tools/phone/ringtone-editor.html), played by the script's audio stream command | Changes with mission progress. The mapping from missions to templates is **Open**. |
| Outgoing ring | `sound.cpp` renders a PCM buffer and plays it with `waveOut` | US ringback from the [ringtone editor](../../tools/phone/ringtone-editor.html)'s reference tones: 440 Hz plus 480 Hz, one 2 second burst that starts 0.5 seconds into the 3 second dial, when the HUD swaps the dialed number for the call timer. It stops when the dial ends or the phone lowers. |
| Busy tone | `sound.cpp`, as above | US busy, 480 Hz plus 620 Hz, four bursts of 0.5 seconds with 0.5 seconds between. It plays `kBusyDelayMs` (2 seconds) into a connected call to a number with no handler, while the timer keeps running, and the call then drops back to number entry. It stops when the phone lowers. |
| Volume | `ReadSfxVolume` in `sound.cpp` | Both tones scale by the game's sound effects slider, read live as the byte at `0x869659` (the front end menu manager at `0x869630`, offset `0x29`; 0 to 127) in gta-vc.exe v1.0. An unreadable or out-of-range byte falls back to 102, the game's default. The address comes from [GTAMods](https://gtamods.com/wiki/Memory_Addresses_(VC)) and is unverified in the game. The layout of `gta_vc.set` is not documented, so the settings file is not read. |
| Digit keys | `sound.cpp`, as above | Standard DTMF pairs, 100 ms, on every digit press in the raised phone, even when the seven digits are full. A new press cuts the previous tone. Other keys are silent. |
| Missed call | Help text after the 20 second ring | `Missed call. Press ~g~P~w~ to call back.` P then dials the stored number of the last caller. |

The ringtone templates are original melodies, not the Nokia tune, which is a registered sound mark.

## Gaps

| Need | Result | Effect |
|---|---|---|
| Radio on or off | `GET_RADIO_CHANNEL` (`051E`) is marked unsupported in Vice City, and `SWITCH_CAR_RADIO` (`036B`) has no class or return value. The only setter is `Audio.SetRadioChannel` (`041E`). | The Zit hotline cannot read the current station or the radio state with a base command. |
| Player control state | No getter. | The phone thread tracks its own raised state through `$PhoneState`. |
| Cutscene state | Only `Cutscene.HasFinished` and `Cutscene.WasSkipped` exist. | The `$onCutscene` global stays the blocked flag. |

The `RadioChannel` enum is `Wildstyle` 0, `FlashFM` 1, `KChat` 2, `Fever` 3, `VRock` 4, `VCPR` 5, `RadioEspantoso` 6, `Emotion` 7, `Wave` 8, `Ambient` 9, `Off` 10, and `Police` 23.
