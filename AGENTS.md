# Agent Instructions: The Eventide Chronicles

These rules apply to every agent working in this repository.

## Documentation

- Read [docs/branding.md](docs/branding.md) and [docs/lore.md](docs/lore.md) before writing or editing any story text, string, or document.
- Check the ledger, [docs/lore.csv](docs/lore.csv), before defining any story element. Use the status it records. Do not contradict a Book entry without adding a departure note.
- Publishing targets and release instructions go in [docs/publish.md](docs/publish.md). Do not put them in the branding or lore documents.
- Tabular data goes in a sibling CSV. Each document names its CSV, and each CSV names its document. Do not put tables of record in prose documents.
- A bug document with one bug has no CSV. Create a sibling CSV only when the document records two or more bugs.
- A bug CSV has the columns `id, status, hazard, location, evidence`. Each cell holds one short phrase. A status starts with an emoji: 🔴 open, 🧪 patched and needing a test, ✅ closed. A location is `main.txt`, a line number, and a label.

## Style

- Use US English and the Oxford comma.
- Use title case for every heading.
- Document titles name the document only, as in "Branding" or "Lore." Do not prefix them with "The Eventide Chronicles:".
- Do not use em dashes in any text.
- Do not use "Episode 2" or "Episode 2 - Miami" in any document or string. The title is "The Eventide Chronicles."

## Tropes

- Every TV Tropes trope named in any document links to its tvtropes.org page.
- Verify each link before writing it. A link is verified when its page loads and its title matches the trope.

## Canon

- The mod's canon wins conflicts with Book 2 of the Enbenite series.
- Record each departure from Book 2 in the ledger with a departure note.
- Record new canon in the ledger as Mod. Record material still undecided as Open.
- Do not treat the Eventide-III repository as canon.

## Scripting

- Use the `sanny-guidance` skill before writing, editing, or reviewing any Sanny Builder script.
- Look up every command in the Sanny Builder Library before using it. The skill lists the lookup tools.
- Read [.agents/lessons/mission-script-safety.md](.agents/lessons/mission-script-safety.md) before you edit a mission script or a looping thread.

## Script Architecture

- `main.txt` is the source and `main.scm` is the compiled build. The game folder is `Sunshine Autos`, a sibling of `Projects`, and it holds a copy of both files in `data`. The game runs `gta-vc.exe` v1.0 with CLEO (`VC.CLEO.asi`) and `scrlog.asi`.
- `main.txt` is Windows-1252, not UTF-8. Edit and Write refuse it. Change it with a command that keeps the encoding.
- `{$USE CLEO}` is set, but the `CLEO` folder holds only text sources and `cleo.log` is empty. The scripts that matter run from `main.scm`.
- `DEFINE MISSION n AT @Label` lists the mission scripts: 0 `INIT`, 1 `Intro`, 2 `Cop`, 3 `Hotel`, 4 `Work`, 5 `Cart`, 6 `BossDie`, 7 `Endgame`, 8 `Fairy`. Missions 9 (`Hell`) and 10 (`Heaven`) are prototypes.
- `MAIN` creates the player, launches mission 0 with `Mission.LoadAndLaunchInternal(0)`, starts `Star`, `Save`, `VPHotel`, and `PackageToggle`, and then terminates. `INIT` starts the free-roam threads, such as `Barrier`, `Pizza`, `Help`, and `VehHeal`.
- The shop robbery mechanic lives in the `Jewelry` thread. Aiming at the store clerk pays $50 each second. After $500 or when the aim stops, the alarm sets the wanted level to 2 stars. No text tells the player a robbery has started. Whether to teach it is open in [docs/TODO.md](docs/TODO.md).
- `script_name` renames the running thread. A thread that falls into another label's `script_name` takes that name in `scrlog.log`.
- Code after a loop runs into the next label. Every thread that loops on `Player.IsPlaying` ends the loop with `terminate_this_script` or a restart. A `return` with an empty gosub stack reads its return address from outside the stack array, so the instruction pointer is garbage, and the game reports invalid opcodes at addresses above 200000000.
- Only mission scripts get the engine's death and bust check, and only while `$ONMISSION` is 1. On death the engine resumes the script after its first gosub and sets `$ONMISSION` to 0. A mission script calls its body as a function on its first line, then tests `has_deatharrest_been_executed` after the call. A mission script with no gosub wrapper and `$ONMISSION` at 1 breaks. `set_deatharrest_state` has no effect outside a mission script.
- To debug a crash, read `scrlog.log` in the game folder. It lists each thread per frame with its instruction pointer. Hazards found so far are in [.agents/bugs/death-and-bust-hazards.md](.agents/bugs/death-and-bust-hazards.md).
- `deno task build` fails with "Sanny Builder did not write" when the compiler exits 0 without output.
- `deno task run` launches the game through `cmd /c start`, because a game started as a Deno child process on Windows ends when Deno exits.
- A compile from the Sanny Builder window can leave older text in `main.txt`. Reload `main.txt` there before a compile.
- The Semgrep rules for Sanny Builder text are in `~/.agents/skills/semgrep/rules/sanny-builder`. They need UTF-8 input, so transcode `main.txt` to a copy before a scan.
