# Agent Instructions: The Eventide Chronicles

These rules apply to every agent working in this repository.

## Documentation

- Read [docs/branding.md](docs/branding.md) and [docs/lore.md](docs/lore.md) before writing or editing any story text, string, or document.
- Check the ledger, [docs/lore.csv](docs/lore.csv), before defining any story element. Use the status it records. Do not contradict a Book entry without adding a departure note.
- Publishing targets and release instructions go in [docs/publish.md](docs/publish.md). Do not put them in the branding or lore documents.
- CSV files are for tabular data sets. Record a single bug in a Markdown document; when one bug document tracks multiple bugs, use a sibling CSV for the tabular records.
- Read [docs/visual-identity.md](docs/visual-identity.md) before making any art, font, color, or HUD change. Colors come from [docs/palette.csv](docs/palette.csv).
- The hidden premise lives only in [docs/spoilers.md](docs/spoilers.md). Do not state or hint at it in any other document, in release art, or in any player-facing string. Link to the spoiler document instead.
- Design specimens, such as typeface and color comparisons, are saved as HTML pages in [docs/specimens](docs/specimens). Show a visual choice as a specimen before asking the user to pick.

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

## Test Plans

- A test plan is for humans. Every case is something a person does and sees in the game or on a page. Keep commands, file hashes and sizes, exit codes, and output comparisons out of the plan. The agent runs those checks itself, through tests or scripts, and reports the results in chat.
- A test plan stands alone. Never refer to the agent, to chat, or to anything outside the page, because a human may read only the plan. Each case starts with the exact command that prepares its build, unless an earlier case in the same plan already installed that build; then it starts from the game menu. Each case then says what to do in the game, and then says what the player sees.
- Do not write a plan that has no human case.

- Test plan pages link the shared [test-plan.css](.agents/testing/test-plan.css), [confetti.js](.agents/testing/confetti.js), and [test-plan.js](.agents/testing/test-plan.js). The script drives the progress bar, saves results in the viewer's browser, and marks a case Passed when every step in it is checked. Colors come from [docs/palette.csv](docs/palette.csv) through the stylesheet's custom properties.
- Preview a test plan through the `docs` server in `.claude/launch.json`. The Browser pane loads local files as `data:` documents, so relative links break.
- A finished test case (Passed or Failed) collapses only its steps. The Expected result stays visible in a `fieldset.expected` group box whose `legend` sits on the border.
- Test case internals use one flex `gap` in `.test-case` and no margins. Measure the visible-edge gaps in the running page after you add an element.
- Read [.agents/lessons/test-plan-visual-centering.md](.agents/lessons/test-plan-visual-centering.md) before you center a number or label in a pill or button.

## Scripting

- Use the `sanny-guidance` skill before writing, editing, or reviewing any Sanny Builder script.
- Look up every command in the Sanny Builder Library before using it. The skill lists the lookup tools.
- Read [.agents/lessons/mission-script-safety.md](.agents/lessons/mission-script-safety.md) before you edit a mission script or a looping thread.
- Use the [debug-missions](.agents/skills/debug-missions/SKILL.md) skill before you debug a script crash, hang, or hazard in `main.txt`.

## Script Architecture

- `main.txt` is the source and `main.scm` is the compiled build. The game folder is `Sunshine Autos`, a sibling of `Projects`, and it holds a copy of both files in `data`. The game runs `gta-vc.exe` v1.0 with CLEO (`VC.CLEO.asi`) and `scrlog.asi`.
- `main.txt` is Windows-1252, not UTF-8. Edit and Write refuse it. Change it with a command that keeps the encoding.
- `main.txt` includes its source with `{$INCLUDE <path>}` lines: `lib/alloc.txt` holds the global `Alloc` lines, `lib/init.txt` holds the startup setup that follows `$ONMISSION = 0` in `MAIN`, `lib/debug.txt` holds the debug flags, `missions/<name>.txt` holds each mission from 1 to 9, and `lib/threads/<name>.txt` holds each thread that mission 0 starts. Include paths use forward slashes. A test or script that reads code from `main.txt` must also read the include file that holds that code, such as `missions/intro.txt` for mission 1.
- `deno task build [--debug-trace] [--debug-wanted]` writes `lib/debug.txt` before it compiles.

     `--debug-trace` sets `DebugTrace` to 1, so MAIN and INIT write `trace.ini`. `deno task install` passes its flags through to the build. The flags go on existing tasks, so do not add a task or script for them.

    Without `--debug-wanted` `DebugWantedLevel` is 0 and the player starts with no wanted level. With the flag it is 2.

- `{$USE CLEO}` is set, but the `CLEO` folder holds only text sources and `cleo.log` is empty. The scripts that matter run from `main.scm`.
- CLEO for Vice City 2.2.0 has `0A92` create_custom_thread and `0A93` end_custom_thread, and no `0A94` start_custom_mission. It cannot run a `.cm` custom mission, so a CLEO script is a plain thread without the engine's death and bust check. Mission scripts live in `missions/*.txt`, and mission 0's threads live in `lib/threads/*.txt`. Porting missions to CLEO threads is tracked in [TODO.md](docs/TODO.md).
- `DEFINE MISSION n AT @Label` lists the mission scripts: 0 `INIT`, 1 `Intro`, 2 `Cop`, 3 `Hotel`, 4 `Work`, 5 `Cart`, 6 `BossDie`, 7 `Endgame`, 8 `Fairy`. Missions 9 (`Hell`) and 10 (`Heaven`) are prototypes.
- `MAIN` creates the player, launches mission 0 with `Mission.LoadAndLaunchInternal(0)`, starts `Star`, `Save`, `VPHotel`, and `PackageToggle`, and then terminates. `INIT` starts the free-roam threads, such as `Barrier`, `Pizza`, `Help`, and `VehHeal`.
- The shop robbery mechanic lives in the `Jewelry` thread. Aiming at the store clerk pays $50 each second. After $500 or when the aim stops, the alarm sets the wanted level to 2 stars. No text tells the player a robbery has started. Whether to teach it is open in [docs/TODO.md](docs/TODO.md).
- `script_name` renames the running thread. A thread that falls into another label's `script_name` takes that name in `scrlog.log`.
- Code after a loop runs into the next label. Every thread that loops on `Player.IsPlaying` ends the loop with `terminate_this_script` or a restart. A `return` with an empty gosub stack reads its return address from outside the stack array, so the instruction pointer is garbage, and the game reports invalid opcodes at addresses above 200000000.
- Only mission scripts get the engine's death and bust check, and only while `$ONMISSION` is 1. On death the engine resumes the script after its first gosub and sets `$ONMISSION` to 0. A mission script calls its body as a function on its first line, then tests `has_deatharrest_been_executed` after the call. A mission script with no gosub wrapper and `$ONMISSION` at 1 breaks. `set_deatharrest_state` has no effect outside a mission script.
- To debug a crash, read `scrlog.log` in the game folder. It lists each thread per frame with its instruction pointer. Hazards found so far are in [.agents/bugs/death-and-bust-hazards.md](.agents/bugs/death-and-bust-hazards.md).
- `deno task build` fails with "Sanny Builder did not write" when the compiler exits 0 without output.
- Check the game's default key bindings before binding a key in a script or plugin. `Q` is the weapon switch, so the package tracker uses `O` and the phone uses `P`. The cell phone's design and sound decisions are in [plugins/cell-phone/README.md](plugins/cell-phone/README.md).
- `deno task run` launches the game through `cmd /c start`, because a game started as a Deno child process on Windows ends when Deno exits.
- `deno task extract-skins [--out dir] [name ...]` copies each model's `.dff` and `.txd` out of `gta3.img` and decodes its textures to PNG. The default name is `IGMerc`, the mesh that every outfit slot copies. Output goes to `skins/`, which Git ignores because the files are game assets.
- `deno task install:skins [name ...] [--dry-run]` installs every `.dff` and `.txd` in `skins/` into `gta3.img` and adds directory entries for new model names. `deno task install` runs it after the script install. Use the `skinning-characters` skill before you change a character's look, and read [.agents/lessons/skin-tooling.md](.agents/lessons/skin-tooling.md) before you change the skin scripts.
- `deno task slice-sheet` measures and cuts a composite sheet, such as `skins/All Skins.jpg`, into one PNG per texture from a manifest like `skins/outfits.csv`. The slices, and every other folder staged for installation, go in `dist/`, which Git ignores. `deno task clean` removes `dist/`. `deno task import-skin` then packs the slices into one TXD.
- The clothing stores are the `Clothes` thread. Each `Pickup.CreateClothes` pickup dresses the player with `Char.Undress($scplayer, 'PLAYERn')`, `Streaming.LoadAllModelsNow`, and `Char.Dress($scplayer)`, using a stock outfit slot that holds one of the mockup outfits. [skins/outfits.csv](skins/outfits.csv) maps each outfit to its `slot` and its `store`, and `scripts/clothes-stores.test.ts` checks the map against the script. `MAIN`, the `Skin` thread, and the Mystery scene dress the player in `PLAYER`, which holds the default outfit.
- A compile from the Sanny Builder window can leave older text in `main.txt`. Reload `main.txt` there before a compile.
- The Semgrep rules for Sanny Builder text are in `~/.agents/skills/semgrep/rules/sanny-builder`. They need UTF-8 input, so transcode `main.txt` to a copy before a scan.
- Deno scripts get their dependencies from packages declared in `deno.json`, added with `deno add`. Search JSR first, then npm, and read the `deno-guidance` skill. Do not hand-write a decoder, encoder, or parser that a package provides. `"nodeModulesDir": "auto"` is set because new npm packages fail to load without it.
