// Control-flow graph of a Sanny Builder script, from any label.
// Usage: deno task start <script.txt> <label>
// Prints the blocks reachable from <label> as one JSON line each.
import { ControlFlow } from "./cfg.ts";

const [scriptPath, startLabel] = Deno.args;
if (!scriptPath || !startLabel) {
  console.error("usage: deno task start <script.txt> <label>");
  Deno.exit(1);
}
const flow = await ControlFlow.load(scriptPath);
if (!flow.has(startLabel)) {
  console.error(`label not found: ${startLabel}`);
  Deno.exit(1);
}
for (const block of flow.reachable(startLabel)) {
  console.log(JSON.stringify(block));
}
