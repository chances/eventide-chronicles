import { join } from "@std/path";

const vc = Deno.env.get("VC");
const vcExe = Deno.env.get("VC_EXE");
if (!vc || !vcExe) {
  console.error("Set VC and VC_EXE in .env to your Vice City installation.");
  Deno.exit(1);
}

const exe = join(vc, vcExe);
try {
  await Deno.stat(exe);
} catch {
  console.error(`Could not find ${exe}`);
  Deno.exit(1);
}

// FIXME: This is totally fucking broken... 😒
const game = new Deno.Command(exe, {
  cwd: vc,
  stdin: "null",
  stdout: "null",
  stderr: "inherit",
}).spawn();
Deno.addSignalListener("SIGINT", killGame);

console.log(`Launched ${vcExe}`);
const { code } = await game.status;
Deno.removeSignalListener("SIGINT", killGame);

if (code !== 0) {
  console.error(`${vcExe} exited with code ${code}`);
  Deno.exit(code);
}
console.log(`Game exited: ${code}`);

/** Try to kill the game. */
function killGame() {
  try {
    game.kill();
  } catch {
    // The game already exited.
  }
  Deno.exit(130);
}
