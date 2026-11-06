/**
 * @module
 * PreToolUse hook script that automatically approves read-only git commands.
 */

const input = JSON.parse(await new Response(Deno.stdin.readable).text());
const commandLine = (input?.toolCall?.args?.CommandLine ?? "").trim();

const isGit = /^git\b/i.test(commandLine);

if (!isGit) {
  console.log(JSON.stringify({ decision: "allow" }));
} else {
  const allowed = /^git\s+(status|diff|log|show|branch|rev-parse)\b/i.test(commandLine);
  if (allowed) {
    console.log(JSON.stringify({
      decision: "allow",
      reason: "Automatically allowed read-only git command in this project.",
    }));
  } else {
    console.log(JSON.stringify({}));
  }
}
