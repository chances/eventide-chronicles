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
