# Modularize Main Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every mission its own file in `missions/` at the repository root, with `main.txt` including each one. A later phase ports individual missions to CLEO threads, only where a CLEO feature needs it.

**Architecture:** Phase 1 is a pure source split. Each mission block moves byte for byte into `missions/<name>.txt`, and `main.txt` keeps an `{$INCLUDE missions/<name>.txt}` line where the block was. An include is textual, so the compiled `main.scm` must stay identical, and the build hash proves it. Phase 2 is a design appendix for porting one mission at a time to a CLEO thread. It does not start until the user names the CLEO feature that needs it.

**Tech Stack:** Deno, Sanny Builder 4.2.0 through `deno task build`, the byte-preserving edit pattern used for `lib/alloc.txt` and `lib/init.txt`.

**Spec:** Sections "Decision Record" and "Findings" below. Sources are linked where each fact appears.

## Decision Record

The request was that each mission become a CLEO mission script in `missions/`. Research found that the CLEO build for Vice City cannot run a mission script of that kind, so the user chose a different path.

| Question | Answer |
| --- | --- |
| What is a mission script for CLEO? | A CLEO mission script, kept in `./missions` at the repository root. |
| Does Vice City CLEO support that? | No. The [VC CLEO 2.2.0 opcode list](https://raw.githubusercontent.com/cleolibrary/III.VC.CLEO/master/source/CLEO_SDK/scm.txt) has `0A92` create_custom_thread, `0A93` end_custom_thread, `0ABA` end_custom_thread_named, and `0AB3` and `0AB4` shared variables. It has no `0A94` start_custom_mission, which is the opcode that starts a `.cm` custom mission in [GTA San Andreas CLEO](https://gtamods.com/wiki/Create_a_mission). |
| What follows from that? | A CLEO script in Vice City is a plain thread. The engine's death and bust check applies only to mission scripts in `main.scm` (see [AGENTS.md](../../AGENTS.md)), so a CLEO thread must handle death, bust, and cleanup by hand. |
| Which path was chosen? | Source split first, then port individual missions to CLEO threads. |

| Approach | Result | Verdict |
| --- | --- | --- |
| Source split into `missions/*.txt` | Missions stay mission scripts and keep the death and bust check. One `main.scm`. No runtime CLEO. | Phase 1 |
| Every mission as a CLEO thread | Each mission loses the engine check, cannot jump to labels in `main.scm`, and shares state through global offsets. Ten risky ports at once. | Rejected |
| Source split, then port | Phase 1 is hash-verifiable. Phase 2 ports one mission when a CLEO feature needs it. | **Chosen** |

## Findings

Measured on `main.txt` as of 2026-10-18, with `lib/alloc.txt`, `lib/init.txt`, and `lib/debug.txt` already extracted.

| `DEFINE MISSION` | Label | Lines | Labels in block | Jumps to labels outside the block | Globals used |
| --- | --- | --- | --- | --- | --- |
| 0 | `INIT` | 469 | 36 | 19 threads, such as `Pizza`, `Barrier`, `Clothes`, and `Skin` | 130 |
| 1 | `Intro` | 443 | 24 | `Police` | 13 |
| 2 | `Cop` | 589 | 37 | `CELL`, `HOT` | 50 |
| 3 | `Hotel` | 376 | 23 | `Boss` | 24 |
| 4 | `Work` | 465 | 18 | `Golf` | 18 |
| 5 | `Cart` | 182 | 10 | `Kill` | 11 |
| 6 | `BossDie` | 274 | 18 | `End` | 10 |
| 7 | `Endgame` | 117 | 9 | none | 6 |
| 8 | `Fairy` | 78 | 6 | none | 5 |
| 9 | `Hell` | 5 | 1 | none | 0 |

- 30 of the 211 globals that the mission blocks use appear in more than one mission block. All of them come from `lib/alloc.txt`.
- The mission blocks are not in step with the `DEFINE MISSION` numbers. The comments read `Mission 0`, `1`, `2`, `3`, `3`, `4`, `5`, `6`, `7`, `8`, so `Mission 3` appears twice.
- `DEFINE MISSION 10 AT @Heaven` has no `:Heaven` label, and `goto @Intro_1455` in `Intro` has no `:Intro_1455` label. `main.scm` builds with both. The split leaves them unchanged.
- Files that read `main.txt` for mission code: `scripts/intro-pickup.test.ts`, and `scripts/clothes-stores.test.ts` for the clothes pickups. The `debug-missions` skill scans `main.txt` with `fallthrough.ts`.
- `docs/voice.csv` keys each string by its line in `main.txt`. Those line numbers are already stale after the `lib/` extractions.
- `VC.CLEO.asi` in the game folder is dated 2025-12-30. Its version is unchecked, and Phase 2 needs it.

## Global Constraints

- US English and the Oxford comma in every document.
- Title case for every heading.
- No em dashes in any text.
- No file is deleted. `git commit` is never run without the user's written permission, so this plan has no commit steps.
- Shell commands use paths relative to the repository root.
- `main.txt` is Windows-1252 with CRLF endings. Edit and Write refuse it. Phase 1 moves blocks with a byte-preserving one-off command, the way `lib/alloc.txt` and `lib/init.txt` were made, and adds no script to the repository.
- Include paths use forward slashes, as in `{$INCLUDE lib/alloc.txt}`.
- Fix one concern per build. Phase 1 changes no behavior, so every task ends with the same `main.scm` hash.
- Install only with the game closed. Phase 1 needs no install until the last task.

## File Structure

| File | Responsibility |
| --- | --- |
| `main.txt` | Threads, spheres, free-roam scripts, and one `{$INCLUDE}` line per mission. |
| `missions/init.txt` | Mission 0, `INIT`. |
| `missions/intro.txt` | Mission 1, `Intro`. |
| `missions/cop.txt` | Mission 2, `Cop`. |
| `missions/hotel.txt` | Mission 3, `Hotel`. |
| `missions/work.txt` | Mission 4, `Work`. |
| `missions/cart.txt` | Mission 5, `Cart`. |
| `missions/bossdie.txt` | Mission 6, `BossDie`. |
| `missions/endgame.txt` | Mission 7, `Endgame`. |
| `missions/fairy.txt` | Mission 8, `Fairy`. |
| `missions/hell.txt` | Mission 9, `Hell`, a prototype. |
| `scripts/intro-pickup.test.ts` | Reads `missions/intro.txt`. |
| `.agents/skills/debug-missions/scripts/fallthrough.ts` | Scans `main.txt` and every file in `missions/` as one source. |
| `AGENTS.md`, `docs/voice.csv`, `.agents/lessons/mission-script-safety.md` | Describe the new layout. |

## Phase 1: Source Split

### Task 0: Record the Baseline

- [ ] **Step 1:** Run `deno task build`. Record `md5sum main.scm`. With the debug flag off, this is `d51f5c819e5b92eb886926facf10246f` today. Record the hash again if `main.txt` changed since.
- [ ] **Step 2:** Run `deno run --allow-read .agents/skills/debug-missions/scripts/fallthrough.ts main.txt` and save the hit list in `dist/baseline-fallthrough.txt`. `dist/` is Git-ignored staging.
- [ ] **Step 3:** Run `deno test --allow-read scripts/intro-pickup.test.ts scripts/clothes-stores.test.ts`. Both must pass before any move.
- [ ] **Step 4:** Copy `main.txt` to `dist/main.txt.baseline` with `cp`. The working copy has uncommitted changes, so Git cannot restore it. A failed move is undone by copying this file back over `main.txt` and deleting the new mission file only after the user agrees.

### Task 1: Extract One Mission

Repeat for the missions in this order, last block first so earlier line numbers do not move: `hell`, `fairy`, `endgame`, `bossdie`, `cart`, `work`, `hotel`, `cop`, `intro`, `init`. The start of mission K is the K-th line that matches `//-------------Mission N---------------`, counting from 0 in file order. The end is the next such line, or the end of the file for the last block.

- [ ] **Step 1:** Run the extraction with K and the file name filled in.

```bash
deno eval 'const K = 9, NAME = "hell"; const lines = new TextDecoder("latin1").decode(await Deno.readFile("main.txt")).split("\r\n"); const marks = lines.flatMap((l, i) => /^\/\/-------------Mission \d+---------------/.test(l) ? [i] : []); const start = marks[K], end = marks[K + 1] ?? lines.length; const block = lines.slice(start, end); const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0)); await Deno.writeFile(`missions/${NAME}.txt`, enc(block.join("\r\n") + "\r\n")); lines.splice(start, block.length, `{$INCLUDE missions/${NAME}.txt}`, ""); await Deno.writeFile("main.txt", enc(lines.join("\r\n"))); console.log(NAME, block.length);'
```

- [ ] **Step 2:** Create the `missions` folder first with `mkdir -p missions`. Read the first and last lines of `missions/<name>.txt`, and read the `{$INCLUDE}` line in `main.txt`.
- [ ] **Step 3:** Run `deno task build`, then `md5sum main.scm`. The hash must equal the baseline. A different hash means the block boundary is wrong. Copy `dist/main.txt.baseline` back over `main.txt` and try again. After a hash match, refresh `dist/main.txt.baseline` with the new `main.txt`.
- [ ] **Step 4:** Update the test that reads the moved code. Only `intro` needs it, in Task 2.

### Task 2: Point the Tests at the Missions

- [ ] **Step 1:** In `scripts/intro-pickup.test.ts`, change `new URL("../main.txt", import.meta.url)` to read `missions/intro.txt`, with the same byte-faithful decoding as `scripts/clothes-stores.test.ts`.
- [ ] **Step 2:** Run `deno test --allow-read scripts/intro-pickup.test.ts scripts/clothes-stores.test.ts`. Both pass.

### Task 3: Scan Every Source File for Fall-Through

- [ ] **Step 1:** Change `fallthrough.ts` to accept several paths and treat them as one source in `main.txt` order, so a label in one file may end where the next file begins.
- [ ] **Step 2:** Run it on `main.txt missions/*.txt` and compare the hit list with `dist/baseline-fallthrough.txt`. The two lists must match apart from file names.
- [ ] **Step 3:** Update step 4 of the `debug-missions` skill to name the new command.

### Task 4: Correct the Mission Markers

- [ ] **Step 1:** In each `missions/<name>.txt`, change the first line to `//-------------Mission N---------------` with N from the `DEFINE MISSION` table above, so `Hotel` reads 3, `Work` reads 4, and so on. The two `Mission 3` markers stop colliding.
- [ ] **Step 2:** Run `deno task build`. The hash equals the baseline, because a comment does not compile.

### Task 5: Update the Documents

- [ ] **Step 1:** In `AGENTS.md`, add `missions/<name>.txt` to the includes bullet, and say that a script reading mission code reads the matching file.
- [ ] **Step 2:** In `.agents/lessons/mission-script-safety.md`, change "Editing the File" to name `main.txt` and `missions/*.txt`.
- [ ] **Step 3:** Re-key `docs/voice.csv`. Add a `file` column, and set each row's `line` from a search for its `text` in `main.txt`, `lib/init.txt`, and `missions/*.txt`. List any row with no match or several matches for the user instead of guessing. This task also repairs the line numbers that the `lib/` extractions broke.

### Task 6: Final Check and Install

- [ ] **Step 1:** Run `deno task build` and confirm the hash equals the baseline.
- [ ] **Step 2:** Run `deno task install` with the game closed, then `md5sum main.scm "../../Sunshine Autos/data/main.scm"`. The two hashes match.
- [ ] **Step 3:** Run `git status --short`. The expected changes are `main.txt`, `missions/`, the two scripts, the skill, the three documents, and `docs/voice.csv`. Report any other file.

## Phase 2: Port a Mission to a CLEO Thread

Do not start Phase 2 until Phase 1 is accepted and the user names the CLEO feature that a mission needs, such as the hotel cutscene or the radio track in [TODO.md](../../docs/TODO.md).

**Pilot candidates.** `Fairy` has 78 lines, 5 globals, and no jump outside its block. `Endgame` has 117 lines, 6 globals, and no jump outside. Pick the one that matches the feature. `Hotel` needs `Boss` started after it, so it ports after a replacement for that jump exists.

**What a ported mission must do by hand.** The engine no longer checks death and bust for it.

| Engine did | The CLEO thread does |
| --- | --- |
| Cancelled the mission body on death or bust | Polls `Player.IsPlaying($PLAYER1)` in its loop and runs its fail path when it is false |
| `Mission.Finish` and `mission_cleanup` | Clears `$ONMISSION`, removes its own pickups and blips, then `end_custom_thread` |
| Jumped to labels in `main.scm` such as `Police` | Sets a global flag or starts the next thread with `create_custom_thread` |
| Shared globals by name | Includes `lib/alloc.txt` so each name keeps its offset, and rebuilds both sides together |

**Build and install.** `deno task build` compiles only `main.txt`. A CLEO script needs its own compile with the `{$CLEO .cs}` directive and its own copy into the game's `CLEO` folder. Extending the build for that belongs to the pilot task, using the existing `deno task install` and no new task.

- [ ] **Step 1:** Confirm the CLEO version. Read the version text on the main menu, or the `VC.CLEO.asi` file version, and record it. `0A92` must exist in that build.
- [ ] **Step 2:** Write the port for the chosen mission and the build step. Ask the user to play it, because working is the user's call.
- [ ] **Step 3:** Compare against `scrlog.log` for a death and a bust case before the mission is accepted, using the `debug-missions` skill.

## Out of Scope

- Splitting the free-roam threads, spheres, and interior scripts out of `main.txt`.
- Fixing the missing `:Heaven` and `:Intro_1455` labels.
- Changing any mission's behavior.
- Moving more than one mission to CLEO per build.
