# First Mission Pass Crash

This document records the symptom, the scope, and the open questions.

## Symptom

The game crashes to the desktop when the player passes the first mission. The game executable is `gta-vc.exe` v1.0. The game shows a dialog titled "Unhandled Exception" with this text.

- Unhandled exception: `c0000005`
- At address: `004582ed`

## Scope

- The first mission is mission 1, `Intro`, which starts from the `Star` thread (`Mission.LoadAndLaunchInternal(1)`, `main.txt` line 1077). Its mission name is `ITBEG`.
- The pass paths are in `:Intro_1450` (`main.txt` 8396 to 8453). They run when the `$Admiral` car is dead or in water.
- The reported reproduction uses the in-water pass path.
- The car-dead pass succeeds when the Admiral explodes and the player is outside the vehicle. A run where the player died ended in hospital respawn and mission cancellation.
- If the player survives, `Car.IsDead($Admiral)` enters the pass branch, while player death is handled by the mission failure wrapper (`main.txt` lines 8090 to 8110 and 8396 to 8420).
- After the pass text and sound, the in-water path calls `Player.LocateAnyMeans2D` with `444.2858, -878.7967, 364.9276, -894.2362, False` (`main.txt` line 8443). It may then set the player's coordinates at line 8445.
- The workspace `main.scm` and installed `data/main.scm` have identical SHA-256 hashes.
- The `Cop` and `Hotel` pass paths start the next thread, then terminate without `Mission.Finish` (`main.txt` lines 9131 to 9133 and 9471 to 9473).
- Both pass paths set `$Intro_Passed = 1` and `$ONMISSION = 0`, fade out, delete the car, and remove the blips and pickups. They then go to `:INTRO_1455`.
- `:INTRO_1455` (`main.txt` 8455 to 8463) fades in, creates the hotel blip and sphere, starts the `Police` thread, and runs `terminate_this_script`.
- The crash address differs from the addresses in [death-and-bust-hazards.md](death-and-bust-hazards.md) (`0x004630EE` and `0x0044BC6F`). Whether the causes are related is not known.

## Trace Findings

- The last recorded `Intro` instructions are `DELETE_CAR`, `MARK_MODEL_AS_NO_LONGER_NEEDED`, three `REMOVE_BLIP` commands, two `REMOVE_PICKUP` commands, and `WAIT`. The trace contains no later `Intro` command.
- The function map places `ProcessCommands500To599` at `00457580` and `ProcessCommands900To999` at `00458EC0`, so `004582ED` falls within the former range ([GTAMods function map](https://gtamods.com/wiki/Function_Memory_Addresses_(VC))). The next source operation is `Player.LocateAnyMeans2D` at `main.txt` line 8443, which does not identify the exact faulting instruction.
- `c0000005` is an access violation. The dialog omits the exception parameters that identify read, write, or execute access and the invalid memory address ([Microsoft Learn](https://learn.microsoft.com/en-us/shows/inside/c0000005)).
- Hypothesis: the in-water check passes rectangle-corner coordinates in center-and-radius positions, including `-894.2362` as the Y radius. The trace ends before that command, and the EIP maps to a different opcode range, so the check is not identified as the faulting instruction.

## Open Questions

- Which instruction after the final `WAIT` faults?
- Is a crash dump or exception record available with the access type and invalid memory address? Availability is unconfirmed.
