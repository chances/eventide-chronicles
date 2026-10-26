# Modularize Main Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give missions 1 to 9 their own files in `missions/` at the repository root, and give the 21 threads that mission 0 starts their own files in `lib/threads/`, with `main.txt` including each one. Mission 0 (`INIT`, the opening cutscene and radar tutorial) stays in `main.txt`, and its one-time global resets move to `lib/init.txt`. CLEO threads are out of scope and tracked in [TODO.md](../../docs/TODO.md).

**Architecture:** A source split in two parts. Part one (Tasks 1 to 6) moves each mission block and each thread body byte for byte into its own file, and `main.txt` keeps an `{$INCLUDE ...}` line where the block was. An include is textual, so the compiled `main.scm` must stay identical, and the build hash proves it. Part two (Task 7) moves the one-time global resets out of `INIT` into `lib/init.txt`. That changes where the code runs, so it gets its own baseline and a game test. The `missions/` folder also holds the Mission Foundry files `0_tutorial.txt`, `1_answering_the_call.txt`, and their `.fsm.json` files. The split never touches them, and its file names (`init.txt`, `intro.txt`, and so on) differ from theirs.

**Tech Stack:** Deno, Sanny Builder 4.2.0 through `deno task build`, the byte-preserving edit pattern used for `lib/alloc.txt` and `lib/init.txt`.

**Spec:** Sections "Decision Record" and "Findings" below. Sources are linked where each fact appears.

## Decision Record

The request was that each mission become a CLEO mission script in `missions/`. Research found that the CLEO build for Vice City cannot run a mission script of that kind, so the user chose a different path.

| Question | Answer |
| --- | --- |
| What is a mission script for CLEO? | A CLEO mission script, kept in `./missions` at the repository root. |
| Does Vice City CLEO support that? | No. The [VC CLEO 2.2.0 opcode list](https://raw.githubusercontent.com/cleolibrary/III.VC.CLEO/master/source/CLEO_SDK/scm.txt) has `0A92` create_custom_thread, `0A93` end_custom_thread, `0ABA` end_custom_thread_named, and `0AB3` and `0AB4` shared variables. It has no `0A94` start_custom_mission, which is the opcode that starts a `.cm` custom mission in [GTA San Andreas CLEO](https://gtamods.com/wiki/Create_a_mission). |
| What follows from that? | A CLEO script in Vice City is a plain thread. The engine's death and bust check applies only to mission scripts in `main.scm` (see [AGENTS.md](../../AGENTS.md)), so a CLEO thread must handle death, bust, and cleanup by hand. |
| Which path was chosen? | Source split only. CLEO ports are out of scope and live in [TODO.md](../../docs/TODO.md). |

| Approach | Result | Verdict |
| --- | --- | --- |
| Source split into `missions/*.txt` | Missions stay mission scripts and keep the death and bust check. One `main.scm`. No runtime CLEO. | **Chosen** |
| Every mission as a CLEO thread | Each mission loses the engine check, cannot jump to labels in `main.scm`, and shares state through global offsets. Ten risky ports at once. | Rejected |

## Findings

Measured on `main.txt` as of 2026-10-18, with `lib/alloc.txt`, `lib/init.txt`, and `lib/debug.txt` already extracted.

| `DEFINE MISSION` | Label | Lines | Labels in block | Jumps to labels outside the block | Globals used |
| --- | --- | --- | --- | --- | --- |
| 0 | `INIT` | 469 | 36 | 21 `start_new_script` lines (`Pizza`, `Bus`, `Barrier`, `Bath`, `Clothes`, `Fae`, `Help`, `Inside`, `JewelryRobbery`, `Lazlow`, `Mystery`, `Music`, `Replay`, `ringu`, `rooftop`, `SaveHot`, `Skin`, `Sphere`, `Swim`, `Water`, `VehHeal`) | 130 |
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
- The `:RandomViolence` stub that followed `Hell` was removed from `main.txt` before the split. It is a mission idea listed in [TODO.md](../../docs/TODO.md). The removal changed `main.scm`, so Task 0 records the baseline hash after it.

- Mission 0 has four parts. `INIT_00` resets about 130 globals and sets the `$HELI1X` to `$HELI4Z` coordinates, with `$BarrierWater` set to 1. The labels `INIT_02` to `INIT_53` are the skippable intro narration. `INIT_6000` is the radar tutorial and the 21 `start_new_script` lines. `INIT_1000` is the death and bust fail path. Those 21 threads start about 40 seconds into the game, after the intro.
- Each started thread is a label followed by a `script_name` line, and runs to the label of the next thread (for example `:Fae` at `script_name 'Fae'` ends where `:Inside` begins). A few labels differ from the `script_name`: `JewelryRobbery` is `Jewelry`, `Bath` is `Bathe`, and `Bus` is `BUS`. Threads that nothing in mission 0 starts (`Star`, `Police`, `HOT`, `Boss`, `Golf`, `Kill`, `End`, `Cell`, `Mall`, `PakTog`, `PACKAGE`, `Pier`, `Save`, `Telport`, `Tools`, `VPHotel`) stay in `main.txt`.
- `lib/init.txt` line 73 reads `$HELI1X`, `$HELI1Y`, and `$HELI1Z` when it creates the helicopter car generator. Those globals are set later, in `INIT_00`, so today the generator reads zeros. Moving the resets into `lib/init.txt` ahead of line 73 changes where that generator spawns.

## Global Constraints

- US English and the Oxford comma in every document.
- Title case for every heading.
- No em dashes in any text.
- No file is deleted. `git commit` is never run without the user's written permission, so this plan has no commit steps.
- Shell commands use paths relative to the repository root.
- `main.txt` is Windows-1252 with CRLF endings. Edit and Write refuse it. The block moves use a byte-preserving one-off command, the way `lib/alloc.txt` and `lib/init.txt` were made, and add no script to the repository.
- A rollback names only the files the failed step changed, such as `git restore main.txt` (and `lib/init.txt` in Task 7). Never run `git reset`, `git checkout .`, `git stash`, or `git restore .`, because they would undo changes this plan never made.
- Include paths use forward slashes, as in `{$INCLUDE lib/alloc.txt}`.
- Fix one concern per build. Tasks 1 to 6 change no behavior, so each ends with the same `main.scm` hash. Task 7 moves code, so it records a new baseline hash and ends with a game test.
- Install only with the game closed. No install is needed until the last task.

## File Structure

| File | Responsibility |
| --- | --- |
| `main.txt` | Mission 0 (`INIT`, the opening cutscene and radar tutorial), the threads that nothing in mission 0 starts, and one `{$INCLUDE}` line per mission and per started thread. |
| `lib/threads/<name>.txt` | One file per thread that mission 0 starts: `pizza`, `bus`, `barrier`, `bath`, `clothes`, `fae`, `help`, `inside`, `jewelryrobbery`, `lazlow`, `mystery`, `music`, `replay`, `ringu`, `rooftop`, `savehot`, `skin`, `sphere`, `swim`, `water`, `car-health`. |
| `lib/init.txt` | Gains the one-time global resets from `INIT_00` (Task 7). |
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
| `scripts/clothes-stores.test.ts` | Reads `lib/threads/clothes.txt`. |
| `.agents/skills/debug-missions/scripts/fallthrough.ts` | Scans `main.txt`, `missions/*.txt`, and `lib/threads/*.txt` as one source in include order. |
| `AGENTS.md`, `docs/voice.csv`, `.agents/lessons/mission-script-safety.md` | Describe the new layout. |

## Tasks

### Task 0: Record the Baseline

- [x] **Step 1:** Run `deno task build`. Record `md5sum main.scm`. The old hash `d51f5c819e5b92eb886926facf10246f` predates the `RandomViolence` removal, so record the new one. **Baseline hash: `57cebd5330f87648653b260b1a8e2069`.**
- [x] **Step 2:** Run `deno run --allow-read .agents/skills/debug-missions/scripts/fallthrough.ts main.txt` and save the hit list in `dist/baseline-fallthrough.txt`. `dist/` is Git-ignored staging.
- [x] **Step 3:** Run `deno test --allow-read scripts/intro-pickup.test.ts scripts/clothes-stores.test.ts`. Both must pass before any move. 8 passed, 0 failed.
- [x] **Step 4:** The user commits the `RandomViolence` removal. `HEAD` is then the rollback point. A failed move is undone with `git restore main.txt`, and the new mission file is removed only after the user agrees. Later checkpoints are the user's commits.

### Task 1: Extract the Missions, One per Pass

Repeat for the missions in this order, last block first so earlier line numbers do not move: `hell`, `fairy`, `endgame`, `bossdie`, `cart`, `work`, `hotel`, `cop`, `intro`. Mission 0 stays in `main.txt`. The start of mission K is the K-th line that matches `//-------------Mission N---------------`, counting from 0 in file order. The end is the next line after the start that is either such a marker or an `{$INCLUDE missions/` line left by an earlier pass, or the end of the file. Earlier passes remove the later markers, so without the `{$INCLUDE` test a block would run on and swallow the includes that follow it.

- [x] **Step 1:** Run the extraction with K and the file name filled in. Done for all nine missions.

```bash
deno eval 'const K = 9, NAME = "hell"; const lines = new TextDecoder("latin1").decode(await Deno.readFile("main.txt")).split("\r\n"); const marks = lines.flatMap((l, i) => /^\/\/-------------Mission \d+---------------/.test(l) ? [i] : []); const start = marks[K]; const next = lines.findIndex((l, i) => i > start && (/^\/\/-------------Mission \d+---------------/.test(l) || l.startsWith("{$INCLUDE missions/"))); const end = next < 0 ? lines.length : next; const block = lines.slice(start, end); const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0)); await Deno.writeFile(`missions/${NAME}.txt`, enc(block.join("\r\n") + "\r\n")); lines.splice(start, block.length, `{$INCLUDE missions/${NAME}.txt}`, ""); await Deno.writeFile("main.txt", enc(lines.join("\r\n"))); console.log(NAME, block.length);'
```

- [x] **Step 2:** Create the `missions` folder first with `mkdir -p missions`. Read the first and last lines of `missions/<name>.txt`, and read the `{$INCLUDE}` line in `main.txt`.
- [x] **Step 3:** Run `deno task build`, then `md5sum main.scm`. The hash must equal the baseline. A different hash means the block boundary is wrong. Run `git restore main.txt` and try again. Hash `57cebd5330f87648653b260b1a8e2069` after each of the nine passes.
- [x] **Step 4:** Update the test that reads the moved code. Only `intro` needs it, in Task 3.

### Task 2: Extract the Started Threads, One per Pass

Repeat for the 21 threads in descending line order, so earlier line numbers do not move. Take the line numbers from `main.txt` at the time, because Task 1 changes them: the thread starts at its label line (`:Pizza`, `:Fae`, and so on) and ends at the line before the next thread's label, found by the next `script_name` line and the label above it. Keep blank lines with the block they follow.

- [x] **Step 1:** Adapt the Task 1 command: take the block from the thread's label to the line before the next thread's label, write it to `lib/threads/<name>.txt`, and replace it in `main.txt` with `{$INCLUDE lib/threads/<name>.txt}` and a blank line.
- [x] **Step 2:** Create `lib/threads` with `mkdir -p lib/threads` first. Read the first and last lines of the new file and the `{$INCLUDE}` line.
- [x] **Step 3:** Run `deno task build`, then `md5sum main.scm`. The hash must equal the baseline. A different hash means a wrong boundary, so run `git restore main.txt` and try again. **New baseline hash: `59b84a1ef1fcb701f376768ab64f7512`, after the permanent `car-health` rename.**
- [x] **Step 4:** Tests that read moved code are updated in Task 3.
### Task 3: Point the Tests at the Moved Code

- [x] **Step 1:** In `scripts/intro-pickup.test.ts`, change `new URL("../main.txt", import.meta.url)` to read `missions/intro.txt`, with the same byte-faithful decoding as `scripts/clothes-stores.test.ts`.
- [x] **Step 2:** In `scripts/clothes-stores.test.ts`, read `lib/threads/clothes.txt` where it reads the clothes pickups.
- [x] **Step 3:** Run `deno test --allow-read scripts/intro-pickup.test.ts scripts/clothes-stores.test.ts`. Both pass.

### Task 4: Scan Every Source File for Fall-Through

- [ ] **Step 1:** Change `fallthrough.ts` to accept several paths and treat them as one source in include order, so a label in one file may end where the next file begins.
- [ ] **Step 2:** Run it on `main.txt`, `missions/*.txt` (without the Foundry files), and `lib/threads/*.txt`, and compare the hit list with `dist/baseline-fallthrough.txt`. The two lists must match apart from file names.
- [ ] **Step 3:** Update step 4 of the `debug-missions` skill to name the new command.

### Task 5: Correct the Mission Markers

- [ ] **Step 1:** In each `missions/<name>.txt`, change the first line to `//-------------Mission N---------------` with N from the `DEFINE MISSION` table above, so `Hotel` reads 3, `Work` reads 4, and so on. The two `Mission 3` markers stop colliding.
- [ ] **Step 2:** Run `deno task build`. The hash equals the baseline, because a comment does not compile.

### Task 6: Update the Documents

- [ ] **Step 1:** In `AGENTS.md`, add `missions/<name>.txt` and `lib/threads/<name>.txt` to the includes bullet, and say that a script reading mission or thread code reads the matching file.
- [ ] **Step 2:** In `.agents/lessons/mission-script-safety.md`, change "Editing the File" to name `main.txt`, `missions/*.txt`, and `lib/threads/*.txt`.
- [ ] **Step 3:** Re-key `docs/voice.csv`. Add a `file` column, and set each row's `line` from a search for its `text` in `main.txt`, `lib/init.txt`, `missions/*.txt`, and `lib/threads/*.txt`. List any row with no match or several matches for the user instead of guessing. This task also repairs the line numbers that the `lib/` extractions broke.

### Task 7: Move the One-Time Resets

This is the only task that changes behavior. Run it after the hash-verified tasks.

- [ ] **Step 1:** Build and record the hash as the new baseline. `HEAD` is the rollback point, so the user commits Tasks 1 to 6 first.
- [ ] **Step 2:** Move the global resets from `INIT_00` (lines 7995 to 8120 before any other move) into `lib/init.txt`. Place them before the `$HELI1_CARGEN` line, which reads `$HELI1X` to `$HELI1Z`. Leave the `$ONMISSION = 0` line in `MAIN`. `INIT_00` keeps the label so the `INIT_00()` call and the labels below it still resolve.
- [ ] **Step 3:** Build. The hash differs from the baseline. Report the cause as the moved resets, and note that the helicopter generator at `$HELI1_CARGEN` now spawns at `$HELI1X` instead of at zero.
- [ ] **Step 4:** Ask the user to play from a new game through the intro, and to die in the opening window (`$ONMISSION` is 1 from `INIT_6000` until the radar tutorial ends). Working is the user's call.

### Task 8: Final Check and Install

- [ ] **Step 1:** Run `deno task build` and confirm the hash equals the Task 7 baseline.
- [ ] **Step 2:** Run `deno task install` with the game closed, then `md5sum main.scm "../../Sunshine Autos/data/main.scm"`. The two hashes match.
- [ ] **Step 3:** Run `git status --short`. The expected changes are `main.txt`, `lib/init.txt`, `lib/threads/`, `missions/`, the two scripts, the skill, the three documents, and `docs/voice.csv`. Report any other file.

## Out of Scope

- Porting any mission to a CLEO thread. The notes are in [TODO.md](../../docs/TODO.md).
- Splitting threads that mission 0 does not start, such as `Star`, `Police`, `Cell`, and `PACKAGE`, and the spheres and interior scripts, out of `main.txt`.
- Fixing the missing `:Heaven` and `:Intro_1455` labels.
- Changing any mission's behavior, apart from Task 7's moved resets.
- Editing the Mission Foundry files in `missions/`.
