import { join } from "@std/path";
import compile from "./compile.ts";
import loadFlags from "./flags.ts";

const flags = await loadFlags();
const cwd = Deno.cwd();
const dist = join(cwd, "dist");
const cleoScripts = join(dist, "CLEO");

// --debug-trace writes trace.ini at each MAIN and INIT step
// --debug-wanted starts the player at 2 stars
// main.txt includes lib/debug.txt, so the flags are written there before main.scm is built.
const debugTrace = Deno.args.includes("--debug-trace") || flags.debug;
const debugWanted = Deno.args.includes("--debug-wanted");
await Deno.writeTextFile(
  join(cwd, "lib", "debug.txt"),
  "// Written by scripts/build.ts. Pass `--debug-trace` or `--debug-wanted` to turn the debug aids on.\r\n" +
    `const DebugTrace = ${debugTrace ? 1 : 0}\r\n` +
    `const DebugWantedLevel = ${debugWanted ? 2 : 0}\r\n`,
);

console.log("Compiling main script...");
await compile(join(cwd, "main.txt"), join(dist, "data", "main.scm"));

console.log("Compiling bath thread...");
Deno.mkdirSync(cleoScripts, { recursive: true })
// FIXME: Output path is wrong
await compile(join(cwd, join("lib" ,"threads", "bath.txt")), join(cleoScripts, "bath.cs"));
