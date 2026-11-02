# Plan

1. **Embed the manifest in `SSA\gta-vc.exe`.** Use the Win32 `UpdateResource` path (type 24, id 1, language 1033) with `BeginUpdateResource(..., false)` so the icon, dialog, and group icon survive. `SSA\asInvoker.manifest` already holds the valid, wrapped version. `gta-vc.bak.exe` is byte-identical to the current exe, so restore is one copy if anything goes wrong.
2. **Read the resource back** from the patched exe and confirm all four resources are present, not just the manifest.
3. **Verify in the game** with `deno task run`. Expect that to still fail with `os error 740` while `WINXPSP3` is in the app-compat layer for that path, since the layer takes priority over an `asInvoker` manifest. I will report exactly what happens rather than claim success.
4. **Update `AGENTS.md`** in the Script Architecture section: the exe needs a full `<assembly>` manifest, `resedit-cli` cannot patch this exe because the resource directory sits mid-image in `.asrc`, `UpdateResource` must not delete existing resources, and `WINXPSP3` in `HKCU\...\AppCompatFlags\Layers` forces elevation so `CreateProcess` (and therefore `deno task run`) fails with 740 while `ShellExecute` still works.

One open item: with `WINXPSP3` left in place, step 3 cannot pass, and the manifest is not what fixes it. Tell me whether to drop `WINXPSP3` from that layer value (keeping `PERPROCESSSYSTEMDPIFORCEOFF HIGHDPIAWARE`), or leave the layer alone and accept that the game must be started elevated.
