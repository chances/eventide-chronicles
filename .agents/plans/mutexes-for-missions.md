# Mutexes For Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable `$ONMISSION`-only gate with an owner-checked, recoverable mutex that prevents missions and scripted scenes from overlapping.

**Architecture:** Store one owner token and one acquisition timestamp in globals. Shared `AcquireMissionLock` and `ReleaseMissionLock` subroutines perform the test-and-set without a `wait`, because a GTA script thread runs opcodes until it yields. Mission and scene entry points acquire before starting work, and every terminal path releases only after cleanup. A watchdog recovers a lock whose owning thread was killed.

**Tech Stack:** Sanny Builder script syntax, Vice City 1.0, CLEO 2.2.0, Deno task scripts, and the existing `DebugTrace`/`trace.ini` diagnostics.

**Spec:** `lib/mission-lock.txt`, `lib/alloc.txt`, `lib/init.txt`, `main.txt`, `missions/*.txt`, and `.agents/lessons/mission-script-safety.md` describe the current behavior and constraints this plan corrects.

## Global Constraints

- `$MissionLock == 0` is the only unlocked state. Every owner token is positive.
- No `wait` may occur between testing `$MissionLock` and assigning the new owner.
- `$MissionLocked` remains a synchronized compatibility flag: it is true exactly when `$MissionLock != 0`.
- Every release checks ownership before changing either lock global.
- Every mission body keeps its existing first-line gosub wrapper and death/arrest check.
- Every changed thread and subroutine obeys `.agents/lessons/mission-script-safety.md`.
- `main.txt` and mission sources remain CRLF and Windows-1252; use byte-preserving scripts for edits.
- Look up every changed Sanny Builder command in the Sanny Builder Library before implementation.
- Do not add a FIFO queue. Busy triggers poll and yield.
- Do not add story text or reveal the hidden premise.

---

## File Map

- Modify `lib/mission-lock.txt`: shared guard, acquire, release, and trace helpers.
- Modify `lib/alloc.txt`: retain and document the lock globals.
- Modify `lib/init.txt`: initialize lock state before mission 0 starts.
- Modify `main.txt`: include the shared routines, gate mission triggers, update mission-0 initialization, and gate scene entry points.
- Modify `missions/intro.txt`, `cop.txt`, `hotel.txt`, `work.txt`, `cart.txt`, `bossdie.txt`, `endgame.txt`, and `fairy.txt`: release only after cleanup.
- Create `lib/threads/lockwatch.txt`: recover a stale lock after the CLEO capability is verified.
- Create `scripts/mission-lock.test.ts`: static invariants for globals, includes, owner IDs, and terminal paths.
- Modify `docs/TODO.md` only if the CLEO capability probe proves that automatic recovery cannot ship.

## Owner Table

`0` is reserved for unlocked and must never be assigned. ID 10 is reserved for watchdog diagnostics.

| ID | Owner |
| ---: | --- |
| 1 | `Intro` |
| 2 | `Cop` |
| 3 | `Hotel` |
| 4 | `Work` |
| 5 | `Cart` |
| 6 | `BossDie` |
| 7 | `Endgame` |
| 8 | `Fairy` |
| 9 | `INIT` |
| 11 | `Cell` |
| 12 | `Pier` |
| 13 | `Mall` |
| 14 | `Save` |
| 15 | `VPHotel` |
| 16 | `SaveHot` |

## Task 1: Define And Test The Lock Contract

**Files:** `lib/mission-lock.txt`, `lib/alloc.txt:309-317`, `lib/init.txt` startup initialization, and new `scripts/mission-lock.test.ts`.

**Interfaces:** `AcquireMissionLock()` consumes owner `0@` and returns `1@ = 1` when granted or `1@ = 0` when busy. `ReleaseMissionLock()` consumes owner `0@` and releases only its owner. `MissionLock_Guard` is the terminal fall-through label.

- [ ] Write a failing Deno test that decodes the Windows-1252 sources and asserts the guard, atomic no-wait acquire, owner-checked release, allocations 8905/8906/8907, and initialization of `$MissionLock`, `$MissionTimer`, and `$MissionLocked`.

```ts
Deno.test("mission lock has an atomic acquire and owner checked release", async () => {
  const decoder = new TextDecoder("windows-1252");
  const lock = decoder.decode(await Deno.readFile("lib/mission-lock.txt"));
  if (!lock.includes(":MissionLock_Guard\nterminate_this_script")) throw new Error("missing guard");
  if (!/\$MissionLock == 0[\s\S]*?\$MissionLock = 0@/.test(lock)) throw new Error("missing acquire");
  if (!/\$MissionLock == 0@[\s\S]*?\$MissionLock = 0\b/.test(lock)) throw new Error("missing owner check");
  if (/\$MissionLock == 0[\s\S]{0,120}\bwait\b/.test(lock)) throw new Error("acquire waits");
});
```

- [ ] Run `deno test scripts/mission-lock.test.ts -v`; expect failure against the incomplete stub.
- [ ] Implement acquire without a `wait`: set `$MissionLock`, `$MissionTimer`, and `$MissionLocked` in the granted branch, then set `1@ = 1`; set only `1@ = 0` in the busy branch.
- [ ] Implement owner-checked release: clear `$MissionLock`, `$MissionTimer`, and `$MissionLocked` only when `$MissionLock == 0@`.
- [ ] Add optional `DebugTrace` records containing `acquire` or `release`, owner ID, and game time.
- [ ] Include `lib/mission-lock.txt` after the final normal main thread so its guard catches fall-through. Initialize all three state globals before `Mission.LoadAndLaunchInternal(0)`.
- [ ] Run `deno test scripts/mission-lock.test.ts -v` and re-read every changed file. Expected: PASS and the exact allocation/startup invariant is visible on disk.

## Task 2: Verify The CLEO Script Lookup

**Files:** temporary probe source, then `lib/threads/lockwatch.txt` only if verified, and `main.txt` only after verification.

**Interface:** The watchdog must use the verified `Memory.GetScriptStructNamed` (`05ED`/`0AAA`) form, not an assumed syntax.

- [ ] Look up the exact command and return value in the Sanny Builder Library and installed CLEO 2.2.0 command set.
- [ ] Build a two-line probe for a known live script and a missing script, writing both results under `DebugTrace`.
- [ ] Run `deno task build --debug-trace`; expect the probe to compile and distinguish nonzero live-script data from zero missing-script data.
- [ ] If unavailable, remove the probe from the build and document the manual-recovery limitation in `docs/TODO.md`; do not ship an automatic timeout based on an unverified command.

## Task 3: Gate The Mission Trigger Chain

**Files:** `main.txt` trigger sections `Star`, `Police`, `HOT`, `Boss`, `Golf`, `Kill`, and `End`; `scripts/mission-lock.test.ts`.

**Interface:** Each trigger acquires its positive owner before fade, control lock, or `Mission.LoadAndLaunchInternal`, and leaves release to the launched mission.

- [ ] Add failing static assertions for launches 1 through 7: positive owner assignment, `AcquireMissionLock`, `1@` success check, and preserved `Player.CanStartMission` and location checks.
- [ ] Run `deno test scripts/mission-lock.test.ts -v`; expect failure against `$ONMISSION`-only gates.
- [ ] Replace each trigger's mutex gate with this pattern after availability/location checks and before irreversible launch work:

```text
0@ = 2
gosub @AcquireMissionLock
if
    1@ == 0
then
    goto @Police_159
end
Mission.LoadAndLaunchInternal(2)
```

- [ ] On a busy result, jump to the existing polling label. Do not release from the trigger after launch.
- [ ] Set `$ONMISSION = true` in `Endgame` before its first mission operation and preserve it through reset handling so the engine death/bust wrapper applies.
- [ ] Remove `terminate_all_scripts_with_this_name 'Golf'` from the Work pass path. Start the next trigger normally, then release the current owner after cleanup.
- [ ] Run the static test and inspect every launch site. Expected: PASS, with no mission trigger relying solely on `$ONMISSION`.

## Task 4: Release Mission Owners After Cleanup

**Files:** all eight files under `missions/` named in the File Map, plus `scripts/mission-lock.test.ts`.

**Interface:** Each mission has one owner-specific exit label. Every pass, fail, death/arrest recovery, reset, and terminal path reaches it after cleanup.

- [ ] Add failing assertions for one exit label per mission, a release call in each exit, and no early `$ONMISSION = 0` before the existing cleanup. Include duplicate fail labels in `cart.txt` and `bossdie.txt`.
- [ ] Run the focused test; expect it to identify the existing early Cop and Work releases.
- [ ] Add exits using the mission's positive owner ID and no `return`:

```text
:Cop_Exit
$ONMISSION = 0
0@ = 2
gosub @ReleaseMissionLock
terminate_this_script
```

- [ ] Route every terminal path through its exit. Keep pass ordering by starting `@HOT` or the next trigger before the current mission releases its owner, so the new trigger waits for the one-frame handoff.
- [ ] Replace scattered release-and-terminate pairs, remove the external Golf kill, and preserve each mission's first-line gosub and death/arrest handler.
- [ ] Run `deno test scripts/mission-lock.test.ts -v`, then scan changed labels for fall-through and empty-stack `return`. Expected: PASS with every exit terminating after release.

## Task 5: Add Verified Recovery Diagnostics

**Files:** `lib/threads/lockwatch.txt`, `main.txt`, and `scripts/mission-lock.test.ts`; `docs/TODO.md` only for the unavailable-command fallback.

**Interface:** `LockWatch` polls every two seconds and clears only a lock with a zero owner lookup and age greater than 10,000 ms.

- [ ] Add failing assertions for the watchdog's bounded wait, nonzero lock check, elapsed-time threshold, zero owner lookup, trace record, and terminating loop.
- [ ] Run the focused test; expect failure because the watchdog is absent.
- [ ] Implement `LockWatch` with diagnostic ID 10. On stale recovery, clear `$MissionLock`, `$MissionTimer`, and `$MissionLocked`, and write owner ID and age under `DebugTrace`.
- [ ] Start it exactly once from `INIT_6000`, after initialization and free-roam startup. Never start it from a mission retry.
- [ ] If Task 2 failed, implement only the documented manual unlock in the existing `Tools` debug path, guarded by `DebugTrace`; do not add an automatic timeout.
- [ ] Run the static test and inspect the final watchdog label. Expected: PASS with no fall-through or empty-stack return.

## Task 6: Gate Scripted Scenes

**Files:** `main.txt` sections `Cell`, `Pier`, `Mall`, `Save`, and `VPHotel`; `lib/threads/savehot.txt`; `lib/threads/mystery.txt` if its Mall launch remains; and `scripts/mission-lock.test.ts`.

**Interface:** Scenes use the same mutex and positive owner IDs, acquiring at the actual player-trigger branch and releasing when control returns to free roam.

- [ ] Add failing assertions that `Cell`, `Pier`, `Mall`, `Save`, `VPHotel`, and `SaveHot` acquire before control/fade/save/cutscene work and release on every return path.
- [ ] Run the static test; expect failure against current `$ONMISSION`-only scene gates.
- [ ] Acquire `Pier` when the player accepts the phone interaction, `Mall` when Mystery launches it, and save-scene owners when the pickup is collected. Do not hold `Cell` while merely waiting for a ring.
- [ ] Route cancellation, death, invalid-player, reset, and success branches through owner-specific exits. Preserve `$ONMISSION` where the engine needs it, but never use it as the sole exclusion test.
- [ ] Run the static test and review each loop for a wait before retry. Expected: PASS, with no scene able to clear another owner's lock.

## Task 7: Build And Play-Test One Hazard At A Time

**Files:** no source changes unless a specific test exposes a regression; inspect generated `main.scm`, installed `data\\main.scm`, `trace.ini`, and `scrlog.log`.

- [ ] Run `deno task build --debug-trace`; verify `main.scm` is newer than the source and the installed and project builds have equal hashes.
- [ ] Complete Intro, enter Cop, and confirm one mission starts, the next trigger waits, and trace records pair acquire/release by owner.
- [ ] Die or get arrested during Cop. Confirm cleanup completes, the Cop owner releases, and `scrlog.log` has no invalid instruction pointer.
- [ ] Test Work pass and failure, confirming Golf is not externally killed and the lock remains held through the existing cleanup waits.
- [ ] Test Endgame reset and completion, confirming mission 7 has engine death/bust state and releases on both paths.
- [ ] Trigger a save, phone, or Mystery scene near a mission trigger. Confirm one waits instead of overlapping and player control returns with `$MissionLock = 0`.
- [ ] If the watchdog shipped, kill a lock-owning script through an existing debug path, wait over 10 seconds, and confirm one stale-lock trace record. Otherwise test the manual unlock and record that automatic recovery is unavailable.
- [ ] Run `deno test scripts/mission-lock.test.ts -v` and `deno task build --debug-trace`; expect static tests to pass and the compiler to write `main.scm`.

## Self-Review Checklist

- [ ] No owner uses sentinel `0`.
- [ ] `$MissionLocked` cannot drift from `$MissionLock` on acquire, release, initialization, or recovery.
- [ ] Cop and Work cleanup remain inside the critical section.
- [ ] Endgame gets the engine mission wrapper before death/bust testing.
- [ ] The watchdog is conditional on a verified CLEO command.
- [ ] Every changed loop yields, every changed thread terminates, and every `return` remains reachable through a gosub.
- [ ] The implementation stops after the diff and verification; the user alone commits.

Do not run `git add` or `git commit`.
