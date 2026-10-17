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

const cwd = Deno.cwd();

console.log("Compiling main script...");
await compile(join(cwd, "main.txt"), join(cwd, "main.scm"));
