# Control Flow and Mission Behavior Gap Analysis: Eventide vs. Sunshine Autos (SSA)

> **Audit Context & Scope:**
> This report evaluates the architectural, control flow, and mission behavioral evolution between the legacy Sunshine Autos codebase (`SSA\data\main.txt`) and **The Eventide Chronicles** repository (`Eventide`).
>
> **Access Boundary Notice:** Direct reading of external path `C:\Users\josie\Documents\GTA Modding\SSA\data\main.txt` via file access tools (`view_file`, `client_view_file`) was blocked by environment workspace policies (`denied by pre-tool hook: Access to path is denied. It is outside the allowed workspace directories`). SSA control flow baseline is reconstructed from verified project references, migration commits, bug histories (`death-and-bust-hazards.csv`, `death-and-bust-hazards.md`), and safety specifications (`mission-script-safety.md`).

---

## 1. Executive Summary

| Dimension | Sunshine Autos (SSA) Legacy | The Eventide Chronicles (This Repo) | Status / Impact |
| :--- | :--- | :--- | :--- |
| **Code Structure** | Monolithic single file (`main.txt` > 10,600 lines) | Modular tree: `main.txt` (2,050 lines) + `lib/` + `missions/` | Significantly cleaner maintenance; requires careful include-order management. |
| **Compiler & Syntax** | Legacy Vice City Sanny Builder format | Sanny Builder 4.2.0 (`{$USE CLEO}`, `{$USE ini}`, `{$USE Audio}`, `Alloc(...)`) | Enables high-level classes, type safety, dynamic audio, and INI configuration. |
| **Mission Death/Arrest Safety** | Direct script jumps; missing gosub wrappers; unhandled engine stack pops | Function wrappers (`Mission_xx()`) testing `has_deatharrest_been_executed` | Prevents fatal engine crash (`0x004630EE` / `0x0044BC6F`) on player death/arrest in missions 1 to 6. |
| **Free-Roam Thread Fall-Through** | Loops exiting on `Player.IsPlaying` falling into arbitrary subroutines | Explicit loop restarts (`wait 250; goto @Loop`) added to resolved threads | Resolves critical hazards (e.g. H6 in `PakTog`/`PACKAGE`); `VehHeal` verified as false positive due to internal exit traps. |
| **$ONMISSION Flag Sanitation** | Flag leaked across script boundaries or left asserted indefinitely | Cleaned at mission terminations and tutorial exit (`INIT_6000`) | Resolves lockouts at mission sphere gates (e.g. H8). |
| **Mission Architecture Paradigm** | Hardcoded internal missions (`Mission.LoadAndLaunchInternal`) | Hybrid: internal missions + CLEO state-machine missions (Mission Foundry FSMs) | Modular Cleo CMs (`0_tutorial.txt`, `1_answering_the_call.txt`) decoupled from global slots. |

---

## 2. Control Flow Analysis

### 2.1 The Mission Death/Arrest Return Mechanism (The Gosub Wrapper Pattern)
In the GTA Vice City script engine (`gta-vc.exe` v1.0 / `reVC` `Script5.cpp: DoDeatharrestCheck`), when a player dies or is arrested during an active mission (`$ONMISSION == 1`), the engine executes `DoDeatharrestCheck`. This routine:
1. Validates that the thread call stack is non-empty (`m_nStackPointer > 0`).
2. Drops nested subroutine stack frames back to the outermost `gosub`.
3. Resumes execution at that outer return address and clears `$ONMISSION = 0`.

#### SSA Legacy Behavior:
In SSA, mission labels (e.g., `:Intro`, `:Cop`, `:Hotel`, `:Work`, `:Fairy`) ran directly as top-level sequential code without an outer `gosub`. On death or bust:
- With an empty stack pointer (`m_nStackPointer == 0`), the engine pops past array boundaries, sending the instruction pointer into unmapped memory (e.g., invalid opcodes `COMMAND_3401`, `COMMAND_6D02`... leading to `C0000005` Access Violation at `0x004630EE`).

#### Eventide Implementation:
Eventide refactored missions 1 through 6 into a structured function wrapper:
```sanny
:MissionName
MissionName_Body()

:MissionName_Check
wait 250
if
    has_deatharrest_been_executed
then
    MissionName_Cleanup()
else
    goto @MissionName_Continue
end
```
- **Verified Patched Missions:**
  - `missions/intro.txt` (`:Intro` -> `Intro_36()`)
  - `missions/cop.txt` (`:Cop` -> `Cop_20()`)
  - `missions/hotel.txt` (`:Hotel` -> `Hotel_36()`)
  - `missions/work.txt` (`:Work` -> `Work_40()`)
  - `missions/cart.txt` (`:Cart` -> `Cart_36()`)
  - `missions/bossdie.txt` (`:BossDie` -> `BossDie_36()`)
- **Gaps / Remaining Hazards:**
  - `missions/fairy.txt` (Mission 8): Still lacks the gosub wrapper. Sets `$ONMISSION = 1` and runs directly into model loading. A death mid-mission will read past the stack (Hazard H1).
  - `missions/endgame.txt` (Mission 7): Resolved (GAP-02). Previously omitted `$ONMISSION = 1` and gosub wrapper. Wrapped in `Endgame_Body()` with death/arrest check and `$ONMISSION` management.
  - `missions/hell.txt` (Mission 9): Empty stub consisting solely of `script_name 'Hell'` with no terminator, falling off the end of the script (Hazard H5).
  - `main.txt` line 20 declares `DEFINE MISSION 10 AT @Heaven`, but no `@Heaven` label exists anywhere in the repository.

---

### 2.2 Free-Roam Thread Lifecycle & Fall-Through Hazards

In Sanny Builder / Vice City bytecode, labels (`:Label`) are merely named memory offsets. Execution continues unconditionally across labels unless explicitly redirected or terminated.

#### Hazard H6 Resolution (`PakTog` & `PACKAGE`):
- **SSA Legacy:** `PakTog` and `PACKAGE` looped on `while Player.IsPlaying($PLAYER1)`. When the player died or was busted, `Player.IsPlaying` became false, the loop terminated, and execution dropped straight into `:Get_Package_Coords`. Because `:Get_Package_Coords` ends in `return` without a preceding `gosub`, the thread popped an invalid return address, generating instruction pointers above `200000000` and crashing.
- **Eventide:** Explicit `wait 250; goto @PakTog_Loop` and `wait 250; goto @PACKAGE_Loop` guards were placed directly after the `while` blocks, keeping threads alive across player respawn cycles.

#### Thread Lifecycle and Fall-Through Analysis:
1. **`lib/threads/car-health.txt` (`:VehHeal` - GAP-04):**
   - **Resolution: False Positive.** In Sanny Builder / Vice City, threads do not fall through this construct. Line 20 begins `while Player.IsPlaying($PLAYER1)`, but the loop body contains immediate internal traps: if player is dead/busted, it deletes `$MyCar`, clears the HUD counter, starts a new script `@VehHeal`, and executes `terminate_this_script`. If the player exits the car, it jumps to `@VehHeal_101`. As a result, execution never reaches past line 43.
2. **`lib/threads/bath.txt` (`:Bath` - GAP-05):**
   - **Resolution: Remediated.** Converted the blocking `wait 120000` into a 250 ms polling loop testing `$TIMER == 0` and `Player.IsPlaying($PLAYER1)`. When the timer expires or the player dies/is busted, execution drops into `:Bath_Exit`, calling `Hud.ClearTimer($TIMER)` and resetting `$ONMISSION = 0` (preventing mission sphere lockout, adhering to Pattern P11).
3. **`lib/threads/bus.txt` (`:BUS` - GAP-06):**
   - **Resolution: Resolved Manually.**

---

## 3. Mission Behavior and State Machine Comparison

### 3.1 Tutorial and Early-Game State Transition
- **SSA Legacy:** The tutorial sequence in `INIT` set `$ONMISSION = 1` around line 8030 (`:INIT_6000`) to flash the radar, but omitted clearing `$ONMISSION = 0` upon tutorial conclusion. This caused the subsequent mission contact sphere (`:Star`, Mission 1) to evaluate `$ONMISSION == 0` as FALSE, permanently locking the player out of progressing (Hazard H8).
- **Eventide:** `main.txt` line 1999 explicitly clears `$ONMISSION = 0` immediately after `Hud.FlashObject(0)`, unblocking the `:Star` contact point sphere.

### 3.2 Adoption of Mission Foundry (CLEO FSMs)
- **SSA Legacy:** Exclusively utilized monolithic SCM routines with global variable allocations (`$PAYPHONE`, `$Intro_Passed`, etc.).
- **Eventide:** Introduces modular CLEO custom mission scripts:
  - `missions/0_tutorial.txt` and `missions/1_answering_the_call.txt`
  - Generated from state-machine definitions (`*.fsm.json`) via `lib/fsm/generate.ts`.
  - Encapsulates private state into CLEO local variables (`0@`–`15@`), eliminating global slot starvation and minimizing side-effects on the base game state.

---

## 4. Summary of Gaps and Actionable Remediation

| Issue ID | File & Location | Description | Recommended Remediation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | `missions/fairy.txt:3` | Mission 8 lacks function/gosub wrapper. Mid-mission death crashes engine. | Wrap body in `Fairy_Start()` and add `has_deatharrest_been_executed` handler before label. | Open |
| **GAP-02** | `missions/endgame.txt:4` | Mission 7 does not assert `$ONMISSION = 1`. | Set `$ONMISSION = 1` on entry, wrap body in gosub, and clear `$ONMISSION = 0` on completion/failure. | Resolved |
| **GAP-03** | `missions/hell.txt:3-6` | Mission 9 is an unterminated stub; Mission 10 (`@Heaven`) is missing. | Add `terminate_this_script` to `:Hell`; add dummy `:Heaven` script with `terminate_this_script`. | Open |
| **GAP-04** | `lib/threads/car-health.txt:43` | `while Player.IsPlaying` has no code after `end`; flagged as potential fall-through. | Add `wait 250` and `goto @VehHeal_101` after line 43. | Closed (False positive: threads do not fall through) |
| **GAP-05** | `lib/threads/bath.txt:34` | Raw `wait 120000` with HUD timer and `$ONMISSION = 1`. | Convert to 250ms polling loop testing `$TIMER == 0` and player status; ensure `Hud.ClearTimer` and `$ONMISSION = 0` on exit. | Resolved |
| **GAP-06** | `lib/threads/bus.txt:2` | `set_deatharrest_state 0` executed in ambient script. | Remove line 2 from `lib/threads/bus.txt`. | Resolved Manually |
