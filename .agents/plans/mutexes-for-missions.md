> @writing-plans @.agents/plans/mutexes-for-missions.md
>
> I've already stubbed some shit, see @lib/mission-lock.txt 

---

Two facts matter:

- `Player.CanStartMission` (`03EE`) is documented as "Returns true if the player can move." It is **not** a mission check.
- `Clock.GetGameTimer` (`01BD`) returns milliseconds since launch. `Memory.GetScriptStructNamed` (`05ED`/`0AAA`) returns a running script's struct or 0.

So today the only real gate is `$ONMISSION`, and the engine writes that variable itself on death and bust. That is a lock whose owner is not the releaser. The fix is a proper mutex.

## Lock Design

A single binary lock with an owner token, held in globals, acquired and released by explicit subroutines. No `wait` may appear between the test and the assignment, which makes it atomic in the GTA script VM because a thread runs opcodes until it waits.

New file `lib/mission-lock.txt`:

```
:MissionLock_Guard
terminate_this_script

:AcquireMissionLock
// in: 0@ = owner id. out: 1@ = 1 granted, 0 busy
if
    $MissionLock == 0
then
    $MissionLock = 0@
    $MissionTimer = Clock.GetGameTimer()
    1@ = 1
else
    1@ = 0
end
return

:ReleaseMissionLock
// in: 0@ = owner id. Releases only if this thread owns it.
if
    $MissionLock == 0@
then
    $MissionLock = 0
end
return
```

`MissionLock_Guard` is the fall-through trap: any thread that runs off the end of the script dies there instead of executing `return` on an empty stack, which is the hazard in `.agents/lessons/mission-script-safety.md`.

Owner ids: 1 `Intro`, 2 `Cop`, 3 `Hotel`, 4 `Work`, 5 `Cart`, 6 `BossDie`, 7 `Endgame`, 8 `Fairy`, 0 `INIT`, and in phase 2, 11 `Cell`, 12 `Pier`, 13 `Mall`, 14 `Save`, 15 `VPHotel`, 16 `SaveHot`.

Globals: `$MissionLock` (8905) and `$MissionTimer` (8906) in `lib/alloc.txt`, initialized to 0 in `lib/init.txt`. Include `lib/mission-lock.txt` last, after `main.txt:2052`.

## Phase 1: Mission Chain

**Acquire in the triggers.** Replace the `$ONMISSION == 0` test at `main.txt:135, 169, 204, 246, 281, 312, 389` with the shared acquire, then launch. The `End` trigger at `main.txt:340-352` has no flag test at all, so it gets the acquire too. Pattern:

```
0@ = 2
gosub @AcquireMissionLock
if
    1@ == 0
then
    goto @Police_159
end
```

Keep `Player.CanStartMission` and the location test after the acquire.

**Release last in every mission.** Add one exit label per mission file, for example `:Cop_Exit`, that does `$ONMISSION = 0`, `0@ = 2`, `gosub @ReleaseMissionLock`, `terminate_this_script`. Route every terminal path to it with `goto`, replacing the scattered `$ONMISSION = 0` lines and their `terminate_this_script`. This is what closes the bug: `cop.txt:467` currently frees the mission for a full second of cleanup, and `work.txt:413` frees it for three seconds. Those paths become `goto @Work_Exit` after cleanup, so the lock stays held.

Sites to convert: `intro.txt` 21, 286, 309, 376, 398, 420; `cop.txt` 467, 492, 519, 590; `hotel.txt` 338, 347, 375; `work.txt` 413, 460; `cart.txt` 137, 162, 179; `bossdie.txt` 248, 268; `endgame.txt` 84, 111, 121; `fairy.txt` 60, 72.

**Spawn the next trigger before the exit.** Pass paths keep `start_new_script @HOT` and similar, then `goto @Cop_Exit`. The new thread blocks on the lock for the one frame between spawn and release.

**Also:**
- `endgame.txt` never sets `$ONMISSION = 1`, so the engine's death check never applies to mission 7. Add it at `:Endgame` and at `:Endgame_ResetCutscene`.
- Delete `terminate_all_scripts_with_this_name 'Golf'` at `work.txt:462`. It is the only external kill in the chain and a lock-leak vector. The pass flag already stops the Golf trigger.
- `bossdie.txt` and `cart.txt` each carry duplicate fail labels (`*_847` and `*_803`). Route both through the same exit.

## Phase 2: Scenes

`Pier` sets `$ONMISSION = 1` at `main.txt:1342` and `:1368`, and `Cell`, `Save`, `VPHotel`, `Mall`, and `SaveHot` read the flag. Once triggers stop reading `$ONMISSION`, a scene can run beside a mission. Give each scene the same lock, acquired when the player triggers it and released when control returns. That makes the lock the single authority for "one scripted scene at a time."

## Recovery

Release is owner-checked, so a stray thread cannot free the lock. The remaining failure is a thread killed while holding it. Add `lib/threads/lockwatch.txt`, started in `INIT_6000`:

- Every 2 seconds, if `$MissionLock != 0`, look up the owner name with `Memory.GetScriptStructNamed` and check `Clock.GetGameTimer() - $MissionTimer`.
- If the lookup returns 0 and more than 10 seconds have passed since acquire, reset `$MissionLock = 0` and log to `trace.ini`.

The 10 second grace covers the pre-launch fade waits. `05ED`/`0AAA` are CLEO extensions, so build a two-line probe first. If VC CLEO 2.2.0 does not expose it, keep a manual unlock in the existing `Tools` debug thread instead.

## Why This Satisfies the Article

- **Mutual exclusion:** one `$MissionLock`, one owner at a time.
- **Progress:** no thread waits for the lock while holding another, so there is no cycle and no deadlock. A busy trigger polls and yields.
- **Bounded waiting:** not FIFO. A ticket queue would add fairness, but trigger spheres are disjoint, so at most one trigger is eligible at a time. It is not worth the extra state.
- **Failure handling:** owner-checked release plus the watchdog.

## Verification

Build with `deno task build --debug-trace`, reproduce a death and a bust during Cop and Work, then read `scrlog.log`. Success means never two of `Intro`, `Cop`, `Hotel`, `Work`, `Cart`, `BossDie`, `Endgame` in the same frame listing. Add acquire and release lines to `trace.ini` with owner id and game time so a leaked lock is visible without a debugger.

I did not leave any changes. An accidental append to `lib/alloc.txt` and `lib/init.txt` was immediately reverted with `git checkout` from the index, so your staged work is intact. To implement this, switch out of Plan mode and I will apply it in the order above, starting with the lock file and the Cop and Work paths, which are the two measured overlaps.
