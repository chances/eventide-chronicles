import { assert, assertEquals, assertNotEquals } from "@std/assert";
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
    const code = await runCapped(Deno.execPath(), ["eval", hog], 512, 60);
    assertNotEquals(code, 0);
    assertNotEquals(
      code,
      124,
      "the limit should stop it before the timeout does",
    );
    assert(performance.now() - started < 50_000);
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
