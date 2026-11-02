import { join } from "@std/path";

/** Feature flags: flags.local.json overrides flags.json */
export default async function loadFlags() {
  const defaults = { debug: { trace: false }, installFxt: true, installTimecyc: true };
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
