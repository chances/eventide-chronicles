# Mutexes For Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `$ONMISSION` with one boolean mutex, `$MissionLocked`, so two missions can never overlap. Scripted scenes keep their current gating and only take the renamed flag.

**Architecture:** `$MissionLocked` replaces `$ONMISSION` as the engine mission flag (`declare_mission_flag $MissionLocked`) and is also the mutex. `$MissionLock` and `$MissionTimer` are removed. Shared `AcquireMissionLock` and `ReleaseMissionLock` subroutines perform the test-and-set without a `wait`, because a GTA script thread runs opcodes until it yields. A mission trigger acquires before irreversible launch work. A mission releases only at its single exit label, after all cleanup, so the lock is free only when a mission is ready to start. Every trigger loop uses structured control flow, and tests plus a formal model check that existing behavior is preserved.

**Tech Stack:** Sanny Builder script syntax, Vice City 1.0, CLEO 2.2.0, Deno task scripts, the existing `DebugTrace`/`trace.ini` diagnostics, and a Lean 4 model of the lock protocol (a failed install triggers a spike in Task 2).

**Sources:** `lib/mission-lock.txt`, `lib/alloc.txt`, `lib/init.txt`, `main.txt`, `missions/*.txt`, and `.agents/lessons/mission-script-safety.md` describe the current behavior and constraints this plan corrects.

## Global Constraints

- `$MissionLocked == false` is the only unlocked state. `$MissionLocked == true` is locked. Boolean values are written with the `true` and `false` keywords, never `0` and `1`.
- `$ONMISSION` is removed everywhere. `declare_mission_flag $MissionLocked` replaces `declare_mission_flag $ONMISSION` at `main.txt:57`. This is pre-alpha refactoring, not deprecation, so no alias remains. `$MissionLock` and `$MissionTimer` (alloc 8905/8906) are removed.
- No `wait` may occur between testing `$MissionLocked` and setting it to `true`.
- Conditions follow Sanny Builder syntax: `if and` or `if or` is the header, each condition sits on its own line; a statement holds at most 8, and every condition runs (no short-circuit), so a check that is unsafe when an earlier one fails goes in an outer `if`. `while true` is a valid infinite loop, left with `break` or `terminate_this_script` (https://docs.sannybuilder.com/language/control-flow/conditions.md and `loops.md`).
- Mutual exclusion properties, each with a test: safety (at most one holder at any time), deadlock freedom (every path from acquire reaches release), and release only after cleanup. Starvation freedom is not required because triggers poll.
- Release does not check ownership; any holder may clear the lock.
- Every mission body keeps its existing first-line gosub wrapper and death/arrest check. Endgame gets one in Task 6; Fairy is deferred to `docs/TODO.md`.
- Every changed thread and subroutine obeys `.agents/lessons/mission-script-safety.md`.
- `main.txt` and mission sources remain CRLF and Windows-1252; use byte-preserving scripts for edits.
- Look up every changed Sanny Builder command in the Sanny Builder Library before implementation.
- Do not add a FIFO queue. Busy triggers poll and yield.
- Do not add story text or reveal the hidden premise.
- Gotos are an anti-pattern. Every trigger loop and every exit path this plan touches is rewritten with `while`, `if`/`else`, and gosub/function calls, and no new `goto` is added (see AGENTS.md).
- Behavior preservation is verified, not assumed: a Deno control-flow test per rewritten trigger against the behavior codified in Task 2 (Task 3 holds the test), and a Lean model of the lock protocol (Task 3).

---

## File Map

- Modify `lib/mission-lock.txt`: shared guard, acquire, release, and trace helpers over `$MissionLocked`.
- Modify `lib/alloc.txt`: delete `$MissionLock` (8905) and `$MissionTimer` (8906), allocate `$MissionLockGranted` in the freed slot 8905; keep `$MissionLocked` (8907) as the mutex and engine flag; remove `$ONMISSION`'s allocation if it has one.
- Modify `lib/init.txt`: initialize `$MissionLocked` to `false` before mission 0 starts.
- Modify `main.txt`: `declare_mission_flag $MissionLocked` at line 57; rename every `$ONMISSION` (21 occurrences); include the shared routines; rewrite the seven mission triggers as structured loops that acquire; gate the INIT death relaunch of mission 0 (`main.txt:1731`).
- Modify `lib/threads/fae.txt`: acquire before `Mission.LoadAndLaunchInternal(8)` (`fae.txt:57`).
- Modify `lib/threads/savehot.txt`, `lib/threads/mystery.txt`, `lib/threads/ringu.txt`, `lib/threads/bus.txt`, `lib/threads/bath.txt`, and the `Cell`, `Pier`, `Mall`, `Save`, `VPHotel` sections of `main.txt`: rename `$ONMISSION` to `$MissionLocked` only; no scene acquires.
- Modify `missions/*.txt` (Cop, Hotel, Work, Cart, BossDie, Endgame, and the Intro mission file): one exit label each that releases after cleanup. Fairy only takes the rename.
- Refactor `missions/work.txt` pass path: drop `terminate_all_scripts_with_this_name 'Golf'`, keep `start_new_script @Golf`.
- Create `lib/mission-lock.test.ts`: static invariants for globals, includes, and terminal paths, under `lib/` with the sources it checks.
- Create `lib/thread-graph.test.ts` and `lib/fixtures/thread-graph.json`: the breadth-first behavior baseline (Task 2).
- Create `lib/mission-flow.test.ts` and `lib/mission-lock.lean`: behavior-preservation checks.

## Task 1: Define And Test The Lock Contract

**Files:** `lib/mission-lock.txt`, `lib/alloc.txt:309-317`, `lib/init.txt` startup initialization, `main.txt:57`, and new `lib/mission-lock.test.ts`.

**Interfaces:** `AcquireMissionLock()` returns its result in the global `$MissionLockGranted` (`true` when granted, `false` when busy). The caller reads it before its next `wait`, so no thread's locals are touched (see `.agents/lessons/sanny-variables.md`). `ReleaseMissionLock()` clears `$MissionLocked` without checking ownership. `MissionLock_Guard` is the terminal fall-through label, which already exists in `lib/mission-lock.txt` and is included after the INIT thread at `main.txt:2077`.

- [ ] Look up `declare_mission_flag` in the Sanny Builder Library before editing.
- [ ] Write a failing Deno test in `lib/` that decodes the Windows-1252 sources (see `scripts/clothes-stores.test.ts`), normalizes CRLF with `.replace(/\r\n/g, "\n")`, extracts the body of each label with a helper, and asserts: the guard label body is `terminate_this_script`, acquire tests `$MissionLocked == false` then sets `$MissionLocked = true` with no `wait` between, release sets `$MissionLocked = false`, `declare_mission_flag $MissionLocked` appears once, and `$ONMISSION`, `$MissionLock`, and `$MissionTimer` appear nowhere in `main.txt`, `lib/`, or `missions/`.
- [ ] Run `deno test -R lib/mission-lock.test.ts`; expect failure against the stub, which still uses owner semantics (`0@`) and `$MissionLock`.
- [ ] Implement acquire without a `wait`: set `$MissionLocked = true` and `$MissionLockGranted = true` in the granted branch; set only `$MissionLockGranted = false` in the busy branch.
- [ ] Implement release: `$MissionLocked = false`. No owner parameter.
- [ ] Add optional `DebugTrace` records containing `acquire` or `release` and game time.
- [ ] Delete the `$MissionLock` and `$MissionTimer` allocations at `lib/alloc.txt:311-313`.
- [ ] Set `$MissionLocked = false` in `lib/init.txt` before `Mission.LoadAndLaunchInternal(0)`. Task 8 holds the lock across every save, so a save never stores a locked state.
- [ ] Run the focused test and re-read every changed file. Expected: PASS and the allocation/startup invariant is visible on disk.

## Task 2: Codify Current Behavior By Breadth-First Analysis

**Files:** new `lib/thread-graph.test.ts`, fixture `lib/fixtures/thread-graph.json`, a throwaway Lean prototype, and `.agents/lessons/mission-lock-model.md`; no game source changes.

**Interface:** The fixture is a graph of every thread and mission reachable from `MAIN`, built level by level so that each node is listed before the nodes it starts. For each node it records: script name and source file with line, parent nodes, outgoing edges (`start_new_script`, `Mission.LoadAndLaunchInternal`, `0600: STREAM_CUSTOM_SCRIPT`, `terminate_all_scripts_with_this_name`, self-restart, `terminate_this_script`), every read and write of `$ONMISSION` with its line, and, for the seven triggers, the ordered guard conditions and effects. Task 3 compares rewrites against this fixture.

- [ ] Parse with the work-in-progress Sanny Builder Language grammar at `D:\Users\enigm\GitHub\tree-sitter-gta3` (no Sanny Builder or SCM parser exists on JSR or npm). Read the `deno-guidance` skill first, then pick a tree-sitter binding for Deno.
- [ ] Resolve `{$INCLUDE ...}` lines recursively from `main.txt`, decoding Windows-1252 and normalizing CRLF.
- [ ] Level 0: `MAIN` (`main.txt:34-115`). Record its edges: `bath.cs` stream, `Mission.LoadAndLaunchInternal(0)`, and the starts of `Star`, `Save`, `VPHotel`, and `PackageToggle`, then its terminate.
- [ ] Level 1: mission 0 `INIT` (`main.txt:1715`) and the nodes level 0 starts. `INIT` starts 20 threads at `main.txt:2039-2058` (`Pizza`, `Bus`, `Barrier`, `Clothes`, `Fae`, `Help`, `Inside`, `JewelryRobbery`, `Lazlow`, `Mystery`, `Music`, `Replay`, `ringu`, `rooftop`, `SaveHot`, `Skin`, `Sphere`, `Swim`, `Water`, `VehHeal`), and its death path relaunches mission 0 (`main.txt:1731`).
- [ ] Level 2: every edge found in the level 1 nodes, including `PackageToggle` to `PACKAGE`, `Mystery` to `Mall`, `ringu` to `Telport`, self-restarts in `Barrier` (`barrier.txt:329`), `ringu` (`ringu.txt:3233`), `HOT` (`main.txt:239`), and `Mystery` (`mystery.txt:81`), the `VehHeal` start in `car-health.txt:33`, and the launches from the seven triggers and `fae.txt:57`.
- [ ] Level 3 and beyond: the mission bodies `Intro`, `Cop`, `Hotel`, `Work`, `Cart`, `BossDie`, `Endgame`, `Fairy`, `Hell`, and `Heaven`, and the threads they start (`HOT` and `Cell` from `cop.txt`, `Golf` from `work.txt:463`, and the rest). Continue until no new node appears.
- [ ] Record unreached labels with a `script_name` (`Tools` has no start site in `main.txt`; the analysis confirms whether any other file starts it). List them as findings; do not delete them.
- [ ] Record every `$ONMISSION` use outside `main.txt` that the earlier file map missed: `ringu.txt` (lines 23, 43, 73, 86, 109), `bus.txt` (lines 32, 962, 998, 1035, 1051, 1087, 1122), `bath.txt` (lines 15, 25, 39, 54, 73), `mystery.txt` (lines 13, 21, 71), `fae.txt:44`, and `savehot.txt:7`.
- [ ] For each of the seven triggers (`Star`, `Police`, `HOT`, `Boss`, `Golf`, `Kill`, `End`), record the guard conditions and effects in order, including every `wait`, the post-launch behavior (loop, terminate, or restart), and `End`'s `break`-out-of-loop path (`main.txt:356-379`).
- [ ] Write `lib/thread-graph.test.ts` to regenerate the graph from the current sources and compare it to the fixture. Run `deno test -R lib/thread-graph.test.ts` against the unmodified sources; expect PASS on the first run, since the fixture is generated from them. Re-read the fixture and spot-check five nodes against the source by hand.
- [ ] Prototype the Lean architecture against the fixture before Task 3 writes any proof. Install the toolchain (`elan`) or record that it cannot be installed, then build a throwaway Lean project that models three real nodes from the fixture (`Star`, the `Cop` mission, and `HOT`) and checks one trivial property by `decide` or `simp`.
- [ ] Settle these architecture decisions from the prototype and write each into `.agents/lessons/mission-lock-model.md` with its reason: (a) how the fixture becomes Lean (a generator that emits a `.lean` file from `lib/fixtures/thread-graph.json`, or hand-written definitions checked against it); (b) the state type (lock bit, per-thread program counter, the other globals the guards read); (c) the step relation (one `wait`-delimited run per step, since a thread runs until it yields); (d) how the world is abstracted (guards such as `Player.CanStartMission` as free inputs); (e) the statement of each property (safety, deadlock freedom, release only after cleanup); (f) how a Lean result ties back to the Deno flow test.
- [ ] If Lean cannot be installed or cannot express these cleanly, record that and spawn a spike to research formal-verification tools that are easier to install. Task 3 uses whichever tool the spike and the user settle on.
- [ ] Stop at the end of Task 2. The user runs the tests and reviews the fixture and `.agents/lessons/mission-lock-model.md` by hand, and Task 3 starts only after that review.

## Task 3: Behavior-Preservation Harness And Lock Model

**Files:** `lib/mission-flow.test.ts`, `lib/mission-lock.lean`, and the Task 2 fixture.

**Interface:** A trigger is reduced to a transition system: guards (the `Player.CanStartMission` and location checks, `$Barrier` flags, and the lock) and effects (fade, launch, wait). The test compares the system before and after each rewrite.

- [ ] Load the seven trigger records from the Task 2 fixture as the baseline. Do not re-derive them.
- [ ] Write the flow test: after the rewrite, for every combination of the non-lock guards, the trigger launches the same mission with the same effect order when `$MissionLocked == false`, and launches nothing and yields when `$MissionLocked == true`. The only allowed difference is the added lock guard and the set of `$MissionLocked = true` on grant.
- [ ] Model the lock protocol in Lean 4 (https://lean-lang.org/learn) using the architecture settled in Task 2: processes are the seven triggers plus the mission threads; state is the lock and each process's program counter. Prove the invariant that at most one process is between acquire and release, and that every path from acquire reaches release.
- [ ] Use the verification tool settled at the end of Task 2; do not choose a different one here.
- [ ] Run `deno test -R lib/mission-flow.test.ts`; expect failure until Task 4 lands the rewrite.

## Task 4: Gate The Mission Trigger Chain

**Files:** `main.txt` trigger sections `Star`, `Police`, `HOT`, `Boss`, `Golf`, `Kill`, and `End`; the INIT death relaunch at `main.txt:1731`; `lib/threads/fae.txt:57`; `lib/mission-lock.test.ts`; `lib/mission-flow.test.ts`.

**Interface:** Each trigger is one `while` loop. After the availability and location checks pass, it acquires before fade, control lock, or `Mission.LoadAndLaunchInternal`, and leaves release to the launched mission.

- [ ] List all 21 `$ONMISSION` occurrences in `main.txt` (lines 57, 58, 140, 180, 216, 259, 295, 327, 406, 1311, 1363, 1389, 1416, 1437, 1493, 1510, 1661, 1738, 2000, 2023, 2034) and classify each as declaration, gate test, or write. Every write becomes a lock write under the rename, so each is justified in the plan notes or fixed: lines 1389 and 1416 (Pier) and 2023 and 2034 (tutorial) set and clear the flag outside any acquire, and `main.txt:1738` (INIT_00) clears it at the start of mission 0 without regard to the holder; the next bullet settles all three.
- [ ] Make mission 0 (`INIT`) hold the lock for its whole opening. `INIT_00` (`main.txt:1737`) acquires in place of its `$ONMISSION = 0` at line 1738, and loops with a `wait` until granted if the lock is busy. The tutorial's `$ONMISSION = true` (line 2023) and `= 0` (line 2034) are removed, and `ReleaseMissionLock` runs where line 2034 was, before the 20 thread starts. The engine's death check is then active for the whole opening, so `INIT_DeadBust` (`main.txt:1723`) re-locks as its first instruction per Task 6. `INIT_1000` replaces its `$ONMISSION = 0` (line 2000) with `ReleaseMissionLock` after its cleanup, so the relaunch's `INIT_00` can acquire instead of deadlocking on its own lock. The Task 2 fixture records the INIT control-flow graph as the baseline (`INIT_00` never returns, `INIT_DeadBust` is reachable only through the engine's resume, and `INIT_6661` terminates). Current control flow of `INIT`, from `tools/cfg` (coral boxes write the flag; purple boxes run only after the engine resumes the script; dashed arrows are not normal flow):

  ```mermaid
  flowchart TD
      INIT["INIT<br/>calls INIT_00(), no return"]
      INIT_00["INIT_00<br/>flag = 0 (line 1738)"]
      NARR["Narration, 12 steps<br/>flag stays 0"]
      TUT["INIT_6000 tutorial<br/>flag 1 at 2023, 0 at 2034"]
      START["Starts 20 threads<br/>then terminates (2074)"]
      DEAD["INIT_DeadBust<br/>engine resumes here"]
      D1000["INIT_1000<br/>flag = 0 (line 2000)"]
      RELAUNCH["Relaunch mission 0<br/>main.txt:1731"]

      INIT --> INIT_00
      INIT_00 --> NARR
      NARR --> TUT
      NARR -- "Shift skips" --> TUT
      TUT --> START
      INIT -.->|"engine resumes after death or arrest"| DEAD
      DEAD --> D1000
      D1000 --> RELAUNCH
      RELAUNCH -.-> INIT

      classDef writes fill:#FAECE7,stroke:#993C1D,color:#712B13
      classDef resume fill:#EEEDFE,stroke:#534AB7,color:#3C3489
      class INIT_00,TUT,D1000 writes
      class DEAD,RELAUNCH resume
  ```
- [ ] Add failing static assertions for launches 1 through 7, the mission 0 relaunch, and the Fairy launch: each calls `AcquireMissionLock`, checks `$MissionLockGranted`, and preserves `Player.CanStartMission` and the location checks.
- [ ] Run the focused tests; expect failure against the `$ONMISSION` gates.
- [ ] Note that `main.txt:151` already calls `gosub @AcquireMissionLock` with `0@` unset, ignores the result, and waits 3000 ms before `LoadAndLaunchInternal(1)`; rewrite it with the others.
- [ ] Rewrite each trigger as a structured loop. Template (labels stay only as `script_name` and thread entry points):

```text
while true
    wait 250
    if
        Player.IsPlaying($PLAYER1)
    then
        if and
            $MissionLocked == false
            Player.CanStartMission($PLAYER1)
            <location check>
        then
            gosub @AcquireMissionLock
            if
                $MissionLockGranted == true
            then
                Mission.LoadAndLaunchInternal(2)
                terminate_this_script
            end
        end
    end
end
```

- [ ] Resolve each trigger's existing waits (Star 3000, Police 1500, HOT 3000, Boss 1500 before launch) so the acquire happens before the first one and the rewritten loop keeps the same effect order; the flow test enforces it.
- [ ] Confirm against the Task 2 fixture what each trigger does after a launch today (loop, terminate, or be restarted by the mission's end), and make the template match it. The template's `terminate_this_script` is a placeholder until then.
- [ ] Keep the `$MissionLocked == false` pre-test before `AcquireMissionLock` so a busy trigger does no work. The acquire still re-tests, because it is the only place the test and the set are guaranteed to have no `wait` between them.
- [ ] On a busy result the loop yields at the top and polls. Do not release from the trigger after launch.
- [ ] Set `$MissionLocked = true` in `Endgame` through its acquire, and add the first-line gosub wrapper (`Body()` then `has_deatharrest_been_executed`) as its own step with a play test per `.agents/lessons/mission-script-safety.md`, before relying on the engine death/bust check there.
- [ ] Run the static and flow tests and inspect every launch site. Expected: PASS, with no mission trigger relying solely on `$MissionLocked` reads and no `goto` in a rewritten trigger.

## Task 5: Refactor Golf Trigger And Work Pass Path

**Files:** `main.txt` Golf trigger section (`main.txt:279-308`), `missions/work.txt` pass path, and `lib/mission-lock.test.ts`.

**Interface:** Work starts `Golf` once on pass and no longer kills it first. Golf is started nowhere else (the INIT thread list at `main.txt:2039-2058` and `main.txt:111-114` do not start it), so `start_new_script @Golf` stays.

- [ ] Remove only `terminate_all_scripts_with_this_name 'Golf'` (`missions/work.txt:462`). Keep `start_new_script @Golf` (`missions/work.txt:463`), ordered before the exit label's release so Golf polls and waits one frame for Work to release.
- [ ] Verify the Golf trigger acquires before `Mission.LoadAndLaunchInternal(5)` using the Task 4 template.
- [ ] Add failing assertions that the Golf trigger acquires before launch, that `terminate_all_scripts_with_this_name 'Golf'` is gone, and that `start_new_script @Golf` remains exactly once.
- [ ] Run the static test. Expected: PASS with Golf using the mutex and no external kill.

## Task 6: Release Mission Lock After Cleanup

**Files:** the mission files under `missions/` named in the File Map, plus `lib/mission-lock.test.ts`.

**Interface:** Each mission has one exit label. Every pass, fail, death/arrest recovery, reset, and terminal path reaches it after cleanup. The lock is released nowhere else, so it is free only when a mission is ready to start.

- [ ] Look up how the engine treats the declared mission flag on death and arrest. AGENTS.md records that the engine clears the flag and resumes the script after its first gosub, which would drop `$MissionLocked` before cleanup. Write a probe under `DebugTrace` that records, from a second thread, whether `$MissionLocked` reads `false` at any frame between the engine clear and the handler's first instruction. Do not rely on a guess either way.
- [ ] Make each death/arrest handler set `$MissionLocked = true` as its first instruction, with no `wait` before it, then run cleanup, then fall into the exit label. If the probe shows another thread can read `false` in that window, halt Task 6 and bring the finding to the user before any mission edit.
- [ ] Add failing assertions for one exit label per mission, a release call in each exit and nowhere else in that file, no `$MissionLocked = false` write before the existing cleanup, and a re-lock as the first instruction of each death/arrest handler. Include duplicate fail labels in `cart.txt` and `bossdie.txt`, and assert that every function reachable from a death branch (such as `Cop_4014`) ends in the exit.
- [ ] Run the focused test; expect it to identify the existing early Cop and Work releases (`cop.txt:590`, `work.txt:460`).
- [ ] Add exits with no owner parameter and no `return`:

```text
:Cop_Exit
gosub @ReleaseMissionLock
terminate_this_script
```

- [ ] Route every terminal path through its exit. Start the next trigger (such as `start_new_script @HOT` at `cop.txt:593`) before the release, so the new trigger polls and waits for the release. In `work.txt` place `Mission.Finish` before the release, and state the order in the exit label.
- [ ] Replace scattered release-and-terminate pairs, and preserve each mission's first-line gosub and death/arrest handler. Rewrite any `goto` in an exit or fail path that this task touches as structured control flow.
- [ ] Run `deno test -R lib/mission-lock.test.ts`, then scan changed labels for fall-through and empty-stack `return`. Expected: PASS with every exit terminating after release.

## Task 7: Manual Unlock For Debugging

**Files:** the existing `Tools` debug path in `main.txt`, and `lib/mission-lock.test.ts`.

**Interface:** A `DebugTrace`-guarded key press calls `ReleaseMissionLock` and writes a trace record. There is no automatic recovery: nothing in the repo kills a lock holder, and the boolean lock stores no owner to look up.

- [ ] Find the `Tools` debug path in `main.txt` and read its guard before editing.
- [ ] Add a failing assertion that the unlock is reachable only when `DebugTrace` is 1.
- [ ] Add the unlock, run the test, and re-read the edited lines. Expected: PASS and no unguarded release call outside mission exits.

## Task 8: Rename The Flag In Scenes And Lock The Save Threads

**Files:** `main.txt` sections `Cell`, `Pier`, `Mall`, `Save`, and `VPHotel`; `lib/threads/savehot.txt`; `lib/threads/mystery.txt`; `lib/threads/ringu.txt` (six `$ONMISSION` sites); `lib/threads/bus.txt` (seven sites); `lib/threads/bath.txt` (streamed as `bath.cs`, six sites); `lib/threads/fae.txt:44`; and `lib/mission-lock.test.ts`.

**Interface:** `Cell`, `Pier`, `Mall`, and the other scenes keep their current gating and ordering; each existing `$ONMISSION` test becomes a `$MissionLocked` test and each existing write keeps its place. The three save threads (`Save`, `VPHotel`, `SaveHot`) acquire the lock after the pickup is collected and before `Game.ActivateSaveMenu`, and release after `Game.HasSaveGameFinished` and the restored control, so the game can never be saved while a mission runs. A busy result prints the existing `BUSY` help and skips the save.

- [ ] Rename `$ONMISSION` to `$MissionLocked` in the scene sections and threads above, one occurrence at a time, keeping the surrounding logic. Where a scene writes the flag (`Pier` at `main.txt:1389` and `1416`, the tutorial at `main.txt:2023` and `2034`, Mystery before it starts Mall), record in the Task 4 audit whether that write can clear a mission's lock.
- [ ] Add the acquire and release to `Save` (`main.txt:1431-1525`), `VPHotel` (`main.txt:1655-1710`), and `SaveHot` (`lib/threads/savehot.txt`). Each thread's retry loop that this edit touches becomes structured control flow, with its behavior checked against the Task 2 fixture.
- [ ] Add failing assertions that `$ONMISSION` appears in none of these files, that every renamed gate tests `$MissionLocked == false`, and that in each save thread `AcquireMissionLock` precedes `Game.ActivateSaveMenu` and `ReleaseMissionLock` follows the `HasSaveGameFinished` wait on every path.
- [ ] Run the static test. Expected: PASS with the renamed gates and no changed control flow in scenes.

## Task 9: Build And Play-Test One Hazard At A Time

**Files:** no source changes unless a specific test exposes a regression; inspect generated `main.scm`, installed `data\\main.scm`, `trace.ini`, and `scrlog.log`.

- [ ] Run `deno task build --debug-trace`; verify `main.scm` is newer than the source and the installed and project builds have equal hashes.
- [ ] Complete Intro, enter Cop, and confirm one mission starts, the next trigger waits, and trace records pair each acquire with one release.
- [ ] Die or get arrested during Cop. Confirm cleanup completes, the Cop exit releases, and `scrlog.log` has no invalid instruction pointer.
- [ ] Test Work pass and failure, confirming Golf still starts after a pass, is not externally killed, and the lock remains held through the existing cleanup waits.
- [ ] Test Endgame reset and completion, confirming mission 7 has the gosub wrapper and engine death/bust state and releases on both paths.
- [ ] Test the Fairy launch (`fae.txt:57`) and the INIT death relaunch of mission 0 (`main.txt:1731`), confirming each acquires and the lock is `false` afterward.
- [ ] Walk the Task 6 probe result: during a Cop death, the trace shows no frame where another thread reads `$MissionLocked == false` before cleanup finishes.
- [ ] Test the manual unlock under `DebugTrace` and confirm the lock reads `false` afterward.
- [ ] Run `deno test -R lib/mission-lock.test.ts lib/mission-flow.test.ts` and `deno task build --debug-trace`; expect the tests to pass and the compiler to write `main.scm`.

## Self-Review Checklist

- [ ] `$ONMISSION`, `$MissionLock`, and `$MissionTimer` appear nowhere in the repository sources.
- [ ] `declare_mission_flag $MissionLocked` appears once, and every `$MissionLocked` write is an acquire, a release, a death-handler re-lock, or an audited scene write.
- [ ] Cop and Work cleanup remain inside the critical section.
- [ ] Endgame has the gosub wrapper before death/bust testing.
- [ ] Every changed loop yields, every changed thread terminates, and every `return` remains reachable through a gosub.
- [ ] No `goto` remains in a rewritten trigger or exit path, and the flow tests pass.
- [ ] The lock model's invariants hold (checked with the tool Task 2 settled).
- [ ] `AGENTS.md` matches the result: the `$ONMISSION` and death-and-bust bullets in Script Architecture.
- [ ] The implementation stops after the diff and verification; the user alone commits.

## Out Of Scope

- Locking the `Cell`, `Pier`, and `Mall` scenes. They are renamed only. `Save`, `VPHotel`, and `SaveHot` do lock, in Task 8, so a save never happens while a mission runs.
- An automatic stale-lock watchdog. Nothing in the repository kills a lock holder.
- The Fairy mission's death/bust wrapper. Fairy only takes the rename; the wrapper is tracked in `docs/TODO.md`.

Do not run `git add` or `git commit`.
