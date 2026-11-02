# Hotkeys and Money Sound

The bugs are tabulated in [hotkeys-and-money-sound.csv](hotkeys-and-money-sound.csv). This document records the symptoms, the scope, and the open questions.

## Symptoms

A playtester reports these bugs.

- No hotkey works. The report names two keys in the introduction cutscene: Left Shift (skip the cutscene) and M (mute the music).
- Left Shift skips the cutscene only if the player holds it before the cutscene starts. It must work at any time while a cutscene runs.
- M works only after the cutscene ends. It must work at all times.
- The money pickup sound is broken. The playtester does not know whether it fails to play or plays wrong.

## Scope

- K1 and K2 concern the introduction in `:INIT_14` and the lines after it.
- K3 covers every other `Pad.IsKeyPressed` call in `main.txt`. The playtester says none work.
- A1 has no known code location. The `Pickup.Create` calls in `main.txt` make health, armor, bribe, and info pickups. The search found no money pickup creation yet.

## Open Questions

- Does Left Shift fail because of the `if or` logic in K1, or because the key code is wrong for the game executable `gta-vc.exe` v1.0?
- Does `stop_audio_stream_1channel` in `:Music` mute the stream or only stop it?
- Does the money pickup sound come from the game engine or from a script call?
