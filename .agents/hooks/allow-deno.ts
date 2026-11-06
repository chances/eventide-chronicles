/**
 * @module
 * PreToolUse hook script that automatically approves deno check, lint, fmt, and test commands.
 */

const input = JSON.parse(await new Response(Deno.stdin.readable).text());
const commandLine = (input?.toolCall?.args?.CommandLine ?? "").trim();

const isDeno = /^deno\b/i.test(commandLine);

if (!isDeno) {
  console.log(JSON.stringify({ decision: "allow" }));
} else {
  const allowed = /^deno\s+(check|lint|fmt|test|task|coverage|doc|info)\b/i.test(commandLine);
  if (allowed) {
    console.log(JSON.stringify({
      decision: "allow",
      reason: "Automatically allowed safe deno command in this project.",
    }));
  } else {
    console.log(JSON.stringify({}));
  }
}
