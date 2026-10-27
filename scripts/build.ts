import { join } from "@std/path";

/** Compiles a script using the Sanny Builder CLI. */
async function compile(inputPath: string, outputPath: string) {
  const startedAt = Date.now();
  const command = new Deno.Command(Deno.env.get("SANNY") ?? "sanny.exe", {
    args: [
      "--no-splash",
      "--mode",
      "vc_sbl",
      "--compile",
      inputPath,
      outputPath,
    ],
    stdout: "inherit",
  });
  const { success } = await command.output();
  if (!success) {
    console.error(`Failed to compile: ${inputPath}`);
    Deno.exit(1);
  }

  // Sanny Builder can exit with code 0 without writing the output file.
  const output = await Deno.stat(outputPath).catch(() => null);
  if (!output?.mtime || output.mtime.getTime() < startedAt) {
    console.error(`Sanny Builder did not write ${outputPath}`);
    Deno.exit(1);
  }
}

/** Runs a command and exits the build when it fails. */
async function run(command: string, args: string[]) {
  const { success } = await new Deno.Command(command, { args, stdout: "inherit" }).output();
  if (!success) {
    console.error(`Failed: ${command} ${args.join(" ")}`);
    Deno.exit(1);
  }
}

const cwd = Deno.cwd();

// The phone plugin (gta-vc.exe is 32-bit, so Win32). `deno task install` copies the built cell-phone.cleo.
const pluginDir = join("plugins", "cell-phone");
const pluginBuildDir = join(pluginDir, "build");
console.log("Building cell-phone plugin...");
await run("cmake", ["-S", pluginDir, "-B", pluginBuildDir, "-A", "Win32"]);
await run("cmake", ["--build", pluginBuildDir, "--config", "Release"]);

// --debug-trace writes trace.ini at each MAIN and INIT step
// --debug-wanted starts the player at 2 stars
// main.txt includes lib/debug.txt, so the flags are written there before main.scm is built.
const debugTrace = Deno.args.includes("--debug-trace");
const debugWanted = Deno.args.includes("--debug-wanted");
await Deno.writeTextFile(
  join(cwd, "lib", "debug.txt"),
  "// Written by scripts/build.ts. Pass `--debug-trace` or `--debug-wanted` to turn the debug aids on.\r\n" +
    `const DebugTrace = ${debugTrace ? 1 : 0}\r\n` +
    `const DebugWantedLevel = ${debugWanted ? 2 : 0}\r\n`,
);

console.log("Compiling main script...");
await compile(join(cwd, "main.txt"), join(cwd, "main.scm"));
