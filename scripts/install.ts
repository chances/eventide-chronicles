import { join } from "@std/path";

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

// Feature flags: flags.local.json overrides flags.json
async function loadFlags() {
  const defaults = { installFxt: true, installTimecyc: true };
  try {
    const text = await Deno.readTextFile(join(Deno.cwd(), "flags.json"));
    Object.assign(defaults, JSON.parse(text));
  } catch {
    // Fallthrough to default
  }
  try {
    const text = await Deno.readTextFile(join(Deno.cwd(), "flags.local.json"));
    Object.assign(defaults, JSON.parse(text));
  } catch {
    // Fallthrough to default
  }
  return defaults;
}

const flags = await loadFlags();

// Debug flags pass through to the build, which writes lib/debug.txt.
const build = await new Deno.Command("deno", {
  args: ["task", "build", ...Deno.args],
  stdout: "inherit",
}).output();
if (!build.success) Deno.exit(1);

const source = join(Deno.cwd(), "main.scm");
const destination = join(vc, "data", "main.scm");

try {
  await Deno.copyFile(source, destination);
} catch (error) {
  console.error(`Failed to install ${source} to ${destination}`);
  throw error;
}
console.log(`Installed ${source} to ${destination}`);

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
