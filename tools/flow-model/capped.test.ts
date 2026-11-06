import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { join } from "@std/path";
import { runCapped } from "./capped.ts";

// Needs Windows job objects: deno test --allow-ffi --allow-run tools/flow-model/capped.test.ts
const windows = Deno.build.os === "windows";

Deno.test({
  name: "a command inside the limit runs to completion and keeps its exit code",
  ignore: !windows,
  fn: async () => {
    assertEquals(
      await runCapped(Deno.execPath(), ["eval", "Deno.exit(7)"], 1024, 60),
      7,
    );
  },
});

Deno.test({
  name: "a command that allocates past the limit is stopped",
  ignore: !windows,
  fn: async () => {
    const started = performance.now();
    const hog =
      "const keep = []; for (;;) keep.push(new Uint8Array(64 * 1024 * 1024).fill(1));";
    const { code, stderr } = await cappedCommand([
      "512",
      "60",
      Deno.execPath(),
      "eval",
      hog,
    ]);
    assertNotEquals(code, 0);
    assertNotEquals(
      code,
      124,
      "the limit should stop it before the timeout does",
    );
    assert(
      stderr.includes("Array buffer allocation failed"),
      `the command should fail on its allocation, got: ${stderr}`,
    );
    assert(performance.now() - started < 50_000);
  },
});

/** Runs capped.ts as a command and returns its exit code and stderr. */
async function cappedCommand(args: string[]) {
  const out = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-ffi",
      "--allow-run",
      "--allow-env",
      join(import.meta.dirname!, "capped.ts"),
      ...args,
    ],
    stdout: "null",
    stderr: "piped",
  }).output();
  return {
    code: out.code,
    stderr: new TextDecoder().decode(out.stderr),
  };
}

Deno.test({
  name: "a run stopped by the memory cap names the memory cap",
  ignore: !windows,
  fn: async () => {
    const hog =
      "const keep = []; for (;;) keep.push(new Uint8Array(32 * 1024 * 1024).fill(1));";
    const { code, stderr } = await cappedCommand([
      "256",
      "60",
      Deno.execPath(),
      "eval",
      hog,
    ]);
    assertEquals(code, 125);
    assert(stderr.includes("memory cap of 256 MB"), stderr);
  },
});

Deno.test({
  name: "a run stopped by the timeout names the timeout",
  ignore: !windows,
  fn: async () => {
    const { code, stderr } = await cappedCommand([
      "1024",
      "2",
      Deno.execPath(),
      "eval",
      "setInterval(() => {}, 1000)",
    ]);
    assertEquals(code, 124);
    assert(stderr.includes("timeout of 2 seconds"), stderr);
  },
});

Deno.test({
  name: "a failure inside both limits names neither",
  ignore: !windows,
  fn: async () => {
    const { code, stderr } = await cappedCommand([
      "1024",
      "60",
      Deno.execPath(),
      "eval",
      "Deno.exit(7)",
    ]);
    assertEquals(code, 7);
    assert(!stderr.includes("cap") && !stderr.includes("timeout"), stderr);
  },
});

Deno.test({
  name: "a command that runs too long is killed at the timeout",
  ignore: !windows,
  fn: async () => {
    assertEquals(
      await runCapped(
        Deno.execPath(),
        ["eval", "setInterval(() => {}, 1000)"],
        1024,
        2,
      ),
      124,
    );
  },
});
