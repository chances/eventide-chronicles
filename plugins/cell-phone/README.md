# Cell Phone

Results of Task 2 in [cell-phone.md](../../.agents/plans/cell-phone.md): the Sanny Builder names that the phone threads use. Every row comes from the [Vice City library data](https://raw.githubusercontent.com/sannybuilder/library/master/vc/vc.json) (`vc.json` and `enums.json`, version 0.408). Names are written in class syntax, with the opcode beside each.

## Confirmed Names

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
| Outgoing ring | Plugin mixes a tone buffer | US ringback, 440 Hz plus 480 Hz, as two short bursts inside the 3 second dial. |
| Busy tone | Plugin mixes a tone buffer | US busy, 480 Hz plus 620 Hz, 0.5 seconds on and 0.5 seconds off. |
| Digit keys | Plugin mixes a tone buffer | Standard DTMF pairs, short. Other keys are silent. |
| Missed call | Help text after the 20 second ring | `Missed call. Press ~g~P~w~ to call back.` P then dials the stored number of the last caller. |

The ringtone templates are original melodies, not the Nokia tune, which is a registered sound mark.

## Gaps

| Need | Result | Effect |
|---|---|---|
| Radio on or off | `GET_RADIO_CHANNEL` (`051E`) is marked unsupported in Vice City, and `SWITCH_CAR_RADIO` (`036B`) has no class or return value. The only setter is `Audio.SetRadioChannel` (`041E`). | Task 11 Step 2 (Zit hotline) cannot read the current station or the radio state with a base command. |
| Player control state | No getter. | The phone thread tracks its own raised state, as the plan already does through `$PhoneState`. |
| Cutscene state | Only `Cutscene.HasFinished` and `Cutscene.WasSkipped` exist. | The plan's `$onCutscene` global stays the blocked flag. |

The `RadioChannel` enum is `Wildstyle` 0, `FlashFM` 1, `KChat` 2, `Fever` 3, `VRock` 4, `VCPR` 5, `RadioEspantoso` 6, `Emotion` 7, `Wave` 8, `Ambient` 9, `Off` 10, and `Police` 23.
