import { join } from "@std/path";

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

// --debug-wanted starts the player at 2 stars. main.txt includes lib/debug.txt,
// so the flag is written there before main.scm is built.
const debugWanted = Deno.args.includes("--debug-wanted");
await Deno.writeTextFile(
  join(Deno.cwd(), "lib", "debug.txt"),
  "// Written by scripts/install.ts. Pass --debug-wanted to turn the debug aids on.\r\n" +
    `const DebugWantedLevel = ${debugWanted ? 2 : 0}\r\n`,
);
const build = await new Deno.Command("deno", {
  args: ["task", "build"],
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
