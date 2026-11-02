import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { clean } from "./clean.ts";

Deno.test("clean removes a folder and everything in it", async () => {
  const dir = await Deno.makeTempDir({ prefix: "clean-test-" });
  await Deno.mkdir(join(dir, "builds", "striped_utility"), { recursive: true });
  await Deno.writeTextFile(join(dir, "builds", "striped_utility", "IGMerc.txd"), "x");
  assertEquals(await clean(dir), true);
  assertEquals(
    await Deno.stat(dir).then(() => true, () => false),
    false,
  );
});

Deno.test("clean reports a folder that is already gone", async () => {
  const dir = await Deno.makeTempDir({ prefix: "clean-test-" });
  await clean(dir);
  assertEquals(await clean(dir), false);
});
