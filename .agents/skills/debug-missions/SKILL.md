---
name: debug-missions
description: Use when a Vice City mission script or free-roam thread in main.txt crashes the game, freezes, or misbehaves on death, bust, exit, retry, or spawn, when scrlog.log shows a wild instruction pointer or invalid opcodes, or when asked to fix a script hazard.
---

# Debug Missions

## Overview

A script crash is a thread whose instruction pointer went somewhere it should not. Find the thread first, then the code, then prove the build under test holds your change. Read [mission-script-safety.md](../../lessons/mission-script-safety.md) for the editing rules. This skill is the order of work.

## When to Use

- The game shows "Unhandled Exception" or "Invalid opcode" after a death, bust, mission pass, or exit.
- A thread, pickup, or character is missing, doubled, or stuck after a retry.
- A hazard in a bug CSV needs a fix or a status change.

Do not use it for text or story edits in `main.txt`.

## Process

1. **Confirm the build.** `main.scm` must be newer than `main.txt`, and the installed `data\main.scm` must have the same hash. `deno task build` fails when the compiler writes nothing. Test only that build.
2. **Capture the crash.** Copy the dialog values and the address. Read `scrlog.log` in the game folder. Look for an address above 1000000, a run of `NOP`, `COMMAND_xxxx` lines, or a thread whose name changed. With no wild address, map the fault address to an opcode range with the GTAMods function map.
3. **Find the thread.** Each `script <name>` header in `scrlog.log` is followed by that thread's commands. Match the name to a `script_name` in `main.txt`.
4. **Scan for fall-through.** Run `deno run --allow-read .agents/skills/debug-missions/scripts/fallthrough.ts main.txt missions/*.txt lib/threads/*.txt`, leaving out the Mission Foundry files `missions/0_tutorial.txt` and `missions/1_answering_the_call.txt`. The script treats the files as one source in include order. Read every hit. An `if` and `else` that both jump is a false hit.
5. **Reproduce fast.** Put an aid right after the player is created in `MAIN`, behind a flag in `lib/debug.txt`. For a bust test, run `deno task install --debug-wanted`, which sets `DebugWantedLevel` to 2.
6. **Log the hazard first.** Add a row to the bug CSV with the columns `id, status, hazard, location, evidence`. One short phrase per cell. Start the status with 🔴, 🧪, or ✅.
7. **Fix one hazard per build.** Edit with `.agents/skills/debug-missions/scripts/replace-once.ts`, which keeps the Windows-1252 bytes and CRLF endings. Read the changed lines back. Build, install, and ask the user to play that case.
8. **Close on the user's word.** Mark ✅ only after the user plays a build that holds the patch. Record that in the evidence cell.

## Quick Reference

| Symptom in `scrlog.log` | Likely cause |
|---|---|
| Thread name changed | A loop ended with no code after it |
| `RETURN` then a wild address | A `return` ran with an empty gosub stack |
| Flag test `FALSE` at a gate | `$ONMISSION` never cleared |
| Normal frames, crash at exit | Not a script frame. Confirm the build, then look outside the script |

## Common Mistakes

| Excuse | Reality |
|---|---|
| "The compiler exited 0, so it compiled." | The exit code says nothing about output. Check the file time. |
| "The user's test passed, so mark it done." | Check that the tested build held the patch. |
| "The log shows normal frames, so scripts are fine." | The crash may be outside a script frame. Check the build first. |
| "Several hazards are obvious, patch them together." | One per build, or a regression has no suspect. |
| "Restart the thread with `start_new_script` on itself." | That reruns its init lines and resets flags. Resume at a label after the init. |

**Violating the letter of this order is violating the spirit of debugging.** A fix without a captured thread and a confirmed build is a guess.
