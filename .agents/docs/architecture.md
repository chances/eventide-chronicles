# Script Architecture

- `main.txt` is the source and `main.scm` is the compiled build. The game folder
  is `Sunshine Autos`, a sibling of `Projects`, and it holds a copy of both
  files in `data`. The game runs `gta-vc.exe` v1.0 with CLEO (`VC.CLEO.asi`) and
  `scrlog.asi`.
- `main.txt` is UTF-8 and holds four-byte emoji. Keep the encoding when a
  command rewrites it.
- `main.txt` includes its source with `{$INCLUDE <path>}` lines, with forward
  slashes in the paths. Shared setup lives under `lib/`, missions 1 to 9 under
  `missions/`, and each thread that mission 0 starts under `lib/threads/`. A
  test or script that reads code from `main.txt` must also read the include file
  that holds that code, such as `missions/intro.txt` for mission 1.
- `deno task build [--debug-trace] [--debug-wanted]` writes `lib/debug.txt`
  before it compiles.

  `--debug-trace` sets `DebugTrace` to 1, so MAIN and INIT write `trace.ini`.
  `deno task install` passes its flags through to the build. The flags go on
  existing tasks, so do not add a task or script for them.

  Without `--debug-wanted` `DebugWantedLevel` is 0 and the player starts with no
  wanted level. With the flag it is 2.

- `main.txt` sets `{$USE CLEO, ini, Audio}`. The scripts that matter run from
  `main.scm`.
- Mission scripts live in `missions/*.txt`, and mission 0's threads live in
  `lib/threads/*.txt`. Porting missions to CLEO threads is tracked in
  [TODO.md](../../docs/TODO.md).
- The `DEFINE MISSION` lines at the top of `main.txt` list the mission scripts.
  Missions 7 (`Endgame`), 8 (`Fairy`), 9 (`Hell`), and 10 (`Heaven`) are
  prototypes.
- `MAIN` creates the player, launches mission 0 with
  `Mission.LoadAndLaunchInternal(0)`, starts `Star`, `Save`, `VPHotel`, and
  `PackageToggle`, and then terminates. `INIT` starts the free-roam threads,
  such as `Barrier`, `Pizza`, `Help`, and `VehHeal`.
- The shop robbery mechanic lives in the `JewelryRobbery` thread
  (`lib/threads/jewelryrobbery.txt`). Aiming at the store clerk pays $50 each
  second. After $500 or when the aim stops, the alarm sets the wanted level to 2
  stars. No text tells the player a robbery has started. Whether to teach it is
  open in [docs/TODO.md](../../docs/TODO.md).
- All GXT refs are (currently, plan is to extract to a fgxt in repo) installed
  at `$VC\TEXT\american.gxt`, where `VC` is the game folder set in `.env`.
- `deno task install:skins [name ...] [--dry-run]` installs every `.dff` and
  `.txd` in `skins/` into `gta3.img` and adds directory entries for new model
  names. `deno task install` runs it after the script install. Use the
  `skinning-characters` skill before you change a character's look, and read
  [.agents/lessons/skin-tooling.md](../../.agents/lessons/skin-tooling.md)
  before you change the skin scripts.
- The slices from `deno task slice-sheet`, and every other folder staged for
  installation, go in `dist/`. `deno task clean` removes `dist/`, and
  `deno task import-skin` packs the slices into one TXD.
- The clothing stores are the `Clothes` thread. Each `Pickup.CreateClothes`
  pickup dresses the player with `Char.Undress($scplayer, '<slot>')`,
  `Streaming.LoadAllModelsNow`, and `Char.Dress($scplayer)`, where `<slot>` is a
  stock outfit slot such as `IGMERC`, `IGMERC2`, or `CHEF` today. The target
  slot is `PLAYERx`, per the FIXME in `lib/threads/clothes.txt`.
  [skins/outfits.csv](../../skins/outfits.csv) maps each outfit to its `slot`
  and its `store`, and `scripts/clothes-stores.test.ts` checks the map against
  the script. `MAIN`, the `Skin` thread, and the Mystery scene dress the player
  in stock outfits (`IGMERC`, `IGMERC2`), not yet in `PLAYERx`.
- `main.txt` is UTF-8, so the Semgrep rules for Sanny Builder text scan it
  directly.
- Deno scripts get their dependencies from packages declared in `deno.json`,
  added with `deno add`. Search JSR first, then npm, and read the
  `deno-guidance` skill. Do not hand-write a decoder, encoder, or parser that a
  package provides. `"nodeModulesDir": "auto"` is set because new npm packages
  fail to load without it.
- `deno.json` has no test task. Run a test file with `deno test` and the
  permissions it needs, such as `deno test -R <file>` for a test that only reads
  files; `scripts/skin-format.test.ts` also needs `--allow-env`.
