---
audience: [ai, human]
---
# Sanny Builder Variables

Follow these rules when you read or write a variable in a Sanny Builder script. The patterns are in [sanny-variables.csv](sanny-variables.csv). Facts come from https://docs.sannybuilder.com/language/data-types/variables.md.

## What the Prefixes and Suffixes Mean

| Spelling | Meaning | Example in this repo |
|---|---|---|
| `$name` | Global variable, shared by every thread | `$Intro_Passed` |
| `N@` | Local variable number `N` of the running script or mission | `0@` and `1@` in `PACKAGE` (`main.txt:722`) |
| `16@`, `17@` | `TIMERA` and `TIMERB` in GTA III and Vice City | |
| `N@s`, `N@v` | Local variable holding a short or long string | |
| `@Name` | Reference to the label `:Name`, not a variable | `goto @Star_159` |

The `@` after a number marks a local. It is not a boolean suffix, so `1@ == true` compares local variable 1 with `true`, and the name `1@` says nothing about what it holds.

## Rules for Writing

1. A local belongs to one thread or mission. Another thread's `1@` is a different variable. Only globals carry values between threads.
2. Vice City gives each script locals `0@` to `15@`, plus the timers `16@` and `17@`.
3. SCM scripts cannot name locals. `int x = 1` works only in CLEO scripts, so `main.txt` and the files it includes write `N@`.
4. A `gosub` or a `Label()` call runs in the caller's scope. A subroutine that writes `1@` overwrites the calling thread's `1@`.
5. Before a subroutine writes a local, read every thread that calls it and confirm none uses that local. Otherwise return the result through a global that the caller reads before its next `wait`.
6. Write booleans with the `true` and `false` keywords, as in `$ONMISSION = true`, never with `0` and `1`.
7. Name what a local holds in a comment at its first use, because the spelling gives no hint.

## What Counts as Done

Report the callers you read and the locals each one uses. Working is the user's call.
