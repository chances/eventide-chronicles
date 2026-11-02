import { join } from "@std/path";
import loadFlags from "./flags.ts";

const flags = await loadFlags();
const cwd = Deno.cwd();
const dist = join(cwd, "dist");
const cleoScripts = join(dist, "CLEO");

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

// Debug flags pass through to the build, which writes lib/debug.txt.
const build = await new Deno.Command("deno", {
  args: ["task", "build", ...Deno.args],
  stdout: "inherit",
}).output();
if (!build.success) Deno.exit(1);

// FIXME: This is repetitive magic-string bullshit; make `dist` installation auto-magical
await installFile(join(dist, "data", "main.scm"), join(vc, "data", "main.scm"));
await installFile(join(cleoScripts, "bath.cs"), join(vc, "CLEO", "bath.cs"));

if (flags.installFxt) {
  const fxtSource = join(Deno.cwd(), "strings.fxt");
  const fxtFolder = join(vc, "CLEO", "CLEO_TEXT");
  const fxtDestination = join(fxtFolder, "strings.fxt");

  // Alternative if CLEO_TEXT does not load: a startup thread calls 0ADF
  // add_dynamic_GXT_entry for each key instead. Parameters are unverified on PC VC.
  await Deno.mkdir(fxtFolder, { recursive: true });
  try {
    await Deno.copyFile(fxtSource, fxtDestination);
  } catch (error) {
    console.error(`Failed to install ${fxtSource} to ${fxtDestination}`);
    throw error;
  }
  console.log(`Installed ${fxtSource} to ${fxtDestination}`);
} else {
  console.log("Skipping FXT install (installFxt disabled)");
}

if (flags.installTimecyc) {
  // Install modified time cycles
  const timecycSource = join(Deno.cwd(), "data", "timecyc.dat");
  const timecycDestination = join(vc, "data", "timecyc.dat");

  try {
    await Deno.copyFile(timecycSource, timecycDestination);
  } catch (error) {
    console.error(`Failed to install ${timecycSource} to ${timecycDestination}`);
    throw error;
  }
  console.log(`Installed ${timecycSource} to ${timecycDestination}`);
} else {
  console.log("Skipping timecyc install (installTimecyc disabled)");
}

async function installFile(source: string, dest: string) {
  try {
    await Deno.copyFile(source, dest);
  } catch (error) {
    console.error(`Failed to install ${source} to ${dest}`);
    throw error;
  }
  console.log(`Installed ${source} to ${dest}`);
}
