import { join } from "@std/path";

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

const source = join(Deno.cwd(), "main.scm");
const destination = join(vc, "data", "main.scm");

try {
  await Deno.copyFile(source, destination);
} catch (error) {
  console.error(`Failed to install ${source} to ${destination}`);
  throw error;
}
console.log(`Installed ${source} to ${destination}`);

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

// 0390 loads `phone` from <VC>\models. `deno task render-phone` builds the TXD.
const txdSource = join(Deno.cwd(), "dist", "phone", "phone.txd");
const txdDestination = join(vc, "models", "phone.txd");
if (await Deno.stat(txdSource).then(() => true, () => false)) {
  await Deno.copyFile(txdSource, txdDestination);
  console.log(`Installed ${txdSource} to ${txdDestination}`);
} else {
  console.warn(`Skipped ${txdSource}, which is not built. Run deno task render-phone.`);
}
