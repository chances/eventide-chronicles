# First Mission Pass Crash

The bug is tabulated in [first-mission-pass-crash.csv](first-mission-pass-crash.csv). This document records the symptom, the scope, and the open questions.

## Symptom

The game crashes to the desktop when the player passes the first mission. The game executable is `gta-vc.exe` v1.0. The game shows a dialog titled "Unhandled Exception" with this text.

- Unhandled exception: `c0000005`
- At address: `004582ed`

## Scope

- The first mission is mission 1, `Intro`, which starts from the `Star` thread (`Mission.LoadAndLaunchInternal(1)`, `main.txt` line 1093). Its mission name is `ITBEG`.
- The pass paths are in `:Intro_1450` (`main.txt` 8407 to 8464). They run when the `$Admiral` car is dead or in water.
- Both pass paths set `$Intro_Passed = 1` and `$ONMISSION = 0`, fade out, delete the car, and remove the blips and pickups. They then go to `:INTRO_1455`.
- `:INTRO_1455` (8466 to 8474) fades in, creates the hotel blip and sphere, starts the `Police` thread, and runs `terminate_this_script`.
- The crash address differs from the addresses in [death-and-bust-hazards.md](death-and-bust-hazards.md) (`0x004630EE` and `0x0044BC6F`). Whether the causes are related is not known.

## Open Questions

- Does the crash happen at the pass fade, at the fade in, or when the `Police` thread starts?
- Does `scrlog.log` in the game folder (`Sunshine Autos`) show a thread with an invalid instruction pointer at the time of the crash?
- Does the crash happen on both pass paths (`$Admiral` dead and `$Admiral` in water)?
- Does a mission script need a call that the `Intro` pass path does not make before `terminate_this_script`?
