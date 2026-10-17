# Load Save Crash

This document records the symptom, the scope, and the open questions.

## Symptom

The game returns to the main menu when the player loads a save game. Before it does, the game shows a dialog titled "CLEO.asi" with this text.

- Incorrect opcode ID: `3B80`

After that dialog, the game shows a second dialog titled "Unhandled Exception" with this text.

- Unhandled exception: `c0000005`
- At address: `0044e302`

After the second dialog, the game closes to the desktop.

## Scope

- The opcode ID `3B80` is not a valid opcode in Vice City. It suggests that a script thread read an instruction pointer that does not point to the start of an instruction.
- The report does not say which save game loads, or which build of `main.scm` made the save.
- The dialog differs from the dialogs in [first-mission-pass-crash.md](first-mission-pass-crash.md) and [death-and-bust-hazards.md](death-and-bust-hazards.md). Whether the causes are related is not known.

## Open Questions

- Does the crash happen with a save made by the current `main.scm`, or only with a save made by an older build?
- Does `scrlog.log` in the game folder (`Sunshine Autos`) show a thread with an invalid instruction pointer at the time of the crash?
- Does the crash depend on which mission or thread was running when the save was made?
- Does a new game started from the current `main.scm` save and load without the dialog?
