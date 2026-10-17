# Mission Script Safety

Follow these rules when you edit `main.txt` to avoid the crashes found so far. The patterns are in [mission-script-safety.csv](mission-script-safety.csv), and the crash hazards found so far are in [death-and-bust-hazards.md](../bugs/death-and-bust-hazards.md).

## How a Script Thread Runs

- A thread keeps running into whatever bytes follow its last statement. `:Label` lines are only names for addresses, so the end of a label is not the end of a thread.
- A thread ends only at `terminate_this_script`. It loops only when a `goto` sends it back.
- `return` pops a return address that a `gosub` pushed. With an empty stack the engine reads outside its stack array, and the instruction pointer becomes garbage.

## Rules for Editing

1. End every thread. After a `while` loop, add `terminate_this_script`, or `wait 250` and a `goto` to the loop label. A loop on `Player.IsPlaying` exits on death or bust, which is when the fall-through crashes.
2. Reach every `return` through a `gosub`. Never let a thread run into a subroutine's label.
3. Call a mission body as a function on its first line, then test `has_deatharrest_been_executed`. The engine resumes a mission script after its first gosub on death, so a body with no gosub wrapper reads past the stack.
4. Use `set_deatharrest_state` only inside a mission script. In any other thread it has no effect.
5. Clear the mission flag (`$ONMISSION = 0`) when a mission or tutorial ends. Gates such as `$ONMISSION == 0` stay closed until it is cleared. The engine clears it only when its death check fires.
6. Check the label after the last statement of every script block, including prototypes. An empty block with no terminate runs off the end of the script.
7. Fix one hazard per build, then play that case. Several patches in one build hide which one broke something.

## How to Find a Crash

- Read `scrlog.log` in the game folder. It lists each thread per frame with its instruction pointer.
- An address above 1000000, a long run of `NOP`, or `COMMAND_xxxx` entries mean a thread ran off its code.
- The values in the error dialog are 16-bit opcodes. Match each one against the log. A run that goes up in steps of 2 is one thread reading memory.
- A thread whose name changed ran into another label's `script_name`.
- Scan for fall-through: list each label whose last statement is not `goto`, `terminate_this_script`, or `return`, and whose next label starts a thread or a subroutine. Read each hit. An `if` and `else` that both jump is a false hit.

## How to Trust a Test

- A compiler that exits with code 0 may write nothing. Check that `main.scm` is newer than `main.txt` before every test.
- Compare the installed `data\main.scm` with the project's. Equal hashes mean the same build.
- A compile from an open Sanny Builder window can save older text over `main.txt`. Reload the file in that window first.
- Mark a hazard done only after a play test on a build that contains the patch.

## Editing the File

- `main.txt` is Windows-1252 with CRLF line endings. Edit and Write refuse it, and a UTF-8 save corrupts it. Change it with a script that reads and writes bytes.
