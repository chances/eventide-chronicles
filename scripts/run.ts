import { join } from "@std/path";

const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

const exe = join(vc, "gta-vc.exe");
try {
  await Deno.stat(exe);
} catch {
  console.error(`Could not find ${exe}`);
  Deno.exit(1);
}

// Deno children die with Deno on Windows, so `start` detaches the game.
const launcher = new Deno.Command("cmd", {
  args: ["/c", "start", "", "/D", vc, exe],
  stdin: "null",
  stdout: "null",
  stderr: "null",
});
const { code } = await launcher.spawn().status;
if (code !== 0) {
  console.error(`Failed to launch ${exe} (cmd exit code ${code})`);
  Deno.exit(code);
}
console.log(`Launched ${exe}`);
