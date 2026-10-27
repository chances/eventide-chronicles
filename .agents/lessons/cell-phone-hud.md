---
audience: [ai, human]
---
# Cell Phone HUD and Probes

Follow these rules when you change the phone thread (`lib/threads/cellphone.txt`), its textures (`deno task render-phone`), the plugin (`plugins/cell-phone`), or a probe in `tests/`. The patterns are in [cell-phone-hud.csv](cell-phone-hud.csv).

## Rules for Probes

1. `deno task probe <name>` installs `tests/<name>-probe.txt` as the only main script, launches the game, and restores the originals. Start every probe from the `data\vc_sbl\stripped.txt` in the Sanny Builder install. A start without `declare_mission_flag`, the dress calls, `Streaming.SetAreaVisible`, and `SetControl` hung on the loading screen.
2. Put `cell-phone.cleo` in `<VC>\CLEO`, `phone.txd` in `<VC>\models`, and `strings.fxt` in `<VC>\CLEO\CLEO_TEXT` before a probe that needs them.
3. The exit code and the SCRLog footer do not tell a crash from a quit here. Ask the user what they saw.
4. Launch the game only when no `gta-vc.exe` is running, and read the result file after it exits.

## Rules for HUD Sprites

1. The sprite and text commands use a 640 by 448 space. In widescreen, x spans the full width, so a quad draws wider than its texture.
2. Texture and GXT names are 8-byte strings in single quotes, at most 7 characters. A double-quoted name froze `Txd.LoadDictionary`.
3. The phone draws one sprite slot per texture. 61 slots load, and the body, the speaker slot, and the LCD frame are one texture.
4. Do not draw the LCD digits with game text. It wrapped them after five digits under every style tried. They are tinted glyph sprites.
5. Take placements from `lib/threads/cellphone-layout.txt`, which `deno task render-phone` writes from the mockup. Do not hand-type coordinates.

## Rules for the Plugin

1. `CLEO_GetVersion()` returns the installed CLEO v2.0.0.6 as `0x00020000 + 6`, so the plugin requires `0x00020000`. A `<<24` packing refused to load.
2. A plugin opcode needs a `{$OPCODE 0B40=8,name %1d% ...}` line in `lib/phone.txt`, or Sanny stops with "Not enough actual parameters".
3. The game does not deliver key messages to a hook on its window thread, so a plugin cannot swallow Escape that way. Escape is future work in [TODO.md](../../docs/TODO.md).
4. `deno task probe` does not install the plugin. Run `deno task build` and `deno task install` after a plugin change, because the game keeps running the old plugin silently otherwise.
5. Tones play through one `waveOut` buffer that `PhoneSound::Stop` resets before it unprepares the header. Do not stop or close the device from `DllMain`, where the loader lock is held.
6. The plugin and the thread share two timings. Keep `kRingbackDelayMs` equal to the `timerb < 500` test in the thread, and derive any call length from the tone cadence in `tones.h`.

## Rules for Dispatches

1. A car or ped that a dial handler spawns stays owned by the script until it is meant to leave. `Car.MarkAsNoLongerNeeded` hands it to the pop cycle, which clears its mission, so a taxi released at arrival drove off before the player reached it.
2. Release on purpose as the last step: give the leaving order first (for the pizza rider, enter the moped, then `CarMission.Cruise`), then release both.
3. Every stage of a dispatch has a frame budget and a death check, and either one releases the vehicle and the ped where they stand.

## What Counts as Done

Report the output of each command and what the user saw. Working is the user's call.
