# Death and Bust Hazards

The hazards are tabulated in [death-and-bust-hazards.csv](death-and-bust-hazards.csv). This document records the symptom, the scope, and the sources. The status column uses 🔴 for open, 🧪 for patched and needing a test, and ✅ for closed.

## Symptom

Playtesting reports that the game often crashes when the player dies or is busted. The crash occurs in free roam and inside missions. The game executable is `gta-vc.exe` v1.0.

## Reproduction

A playtester reports this sequence after being busted by the cops. Each invalid opcode is shown as the 16-bit value the game prints, as in `COMMAND_3401` in `scrlog.log`.

1. The game reports invalid opcode `3401`.
2. The game shows the busted text, then reports invalid opcode `6D02`.
3. The game shows "Mission Failed", then reports invalid opcode `6E02`.
4. The game reports invalid opcode `3501`.
5. The game reports invalid opcode `7002` twice.
6. The wanted level changes.
7. The game reports invalid opcode `3701`.
8. The game reports invalid opcode `7202` twice.
9. The game reports invalid opcode `3801`.
10. The game reports invalid opcode `7402`.
11. The screen fades to black.
12. The game reports invalid opcode `7902`.
13. The game reports invalid opcode `3901`.
14. The game reports invalid opcode `7C02` twice.
15. The game reports invalid opcode `3F01`.
16. The game raises unhandled exception `C0000005` at address `0x004630EE`.
17. The game crashes to the desktop.

Valid game actions (the busted text, "Mission Failed", the wanted level change, and the fade) occur between the invalid opcodes. This mix is consistent with a script instruction pointer that lands inside the wrong bytes. The cause is not identified.

## Script Log

`scrlog.log` in the game folder (`Sunshine Autos`) records each script thread per frame.

- The game's `data\main.scm` and the project `main.scm` have the same SHA-256 hash.
- The `init` thread runs `HAS_DEATHARREST_BEEN_EXECUTED` (TRUE), then a gosub to the `MISFAIL` print. `INIT_DeadBust` ran in this repro.
- The `package` thread (`script_name 'PACKAGE'`, locals `0@ = 0` and `1@ = 1`) runs at instruction pointer `205164313` and up. It runs one invalid opcode per frame, and the values match the reported trace (`6D02` through `7C02` at `205164324` to `205164348`).
- No other thread shows an invalid instruction pointer.
- The invalid opcodes come from the `PACKAGE` thread, not from a mission script's death check.
- The `paktog` thread disappears from the log where the `package` thread appears. `PakTog` has no code after its `while Player.IsPlaying` loop, so it runs into `:PACKAGE` and renames itself. `PACKAGE` has the same gap and runs into `:Get_Package_Coords`, whose `return` pops an empty gosub stack. This is hazard H6.
- A second capture (exception `C0000005` at `0x0044BC6F`, no invalid opcodes) shows the same path: `paktog` runs `SCRIPT_NAME`, the `Get_Package_Coords` comparisons, and `RETURN`, then executes `NOP` at instruction pointer `71178790` and up.

## Scope

- H1 relates to mission deaths only.
- H2, H3, and H4 concern the death handling in `MAIN` and `INIT`. Playtesters report that they relate to the crashes. H2 is closed as not a defect.
- H5 concerns missions 9 and 10, which are prototypes and are out of scope for now.
- H6 matches the reproduction: the `PACKAGE` thread runs invalid opcodes after the player is busted. After the fix, a bust and a wasted both respawn the player without a crash.
- Whether H6 explains every crash is not yet known.
- A temporary 2-star wanted level (`TEMP DEBUG`, `main.txt` line 348) supports bust testing. Remove it before release.

## Sources

- [GTAMods Wiki, Opcode 0111](https://gtamods.com/wiki/0111): `set_deatharrest_state` only has an effect in scripts launched with opcode 0417 or 00D7.
- [re3 commit 68db861, Script5.cpp](https://git.shihaam.dev/archivemirrors/re3/commit/68db861c45755f3b5996895003ba638f7f6ace05.diff): `DoDeatharrestCheck` runs only while the mission flag variable is 1. It runs `script_assert(m_nStackPointer > 0)`, drops every gosub except the outermost, resumes the script at that return address, and sets the mission flag to 0. [reVC Script5.cpp](https://github.com/mrxenginner/reVC/blob/miami/src/control/Script5.cpp) has the full function.
- [re3 Script.cpp](https://github.com/nosro1/re3/blob/ead2747e/src/control/Script.cpp): `CRunningScript::Process` calls `DoDeatharrestCheck` for every mission script.
