// Compiles a probe script to a main.scm and installs it as the only main script in the Vice City folder.
// Every existing main.scm (data/ and modloader/*/data/) moves to <VC>/.main-backup/<stamp>/ first.
// Then it launches the game, waits for it to exit, restores the backups, and writes the findings to
// tests/results/<name>-<stamp>.md.
// Usage: deno task probe <name>   (installs tests/<name>-probe.txt)

import { basename, dirname, join, relative, resolve } from "@std/path";

let name = Deno.args[0];
if (!name) {
  const probes: string[] = [];
  for await (const entry of Deno.readDir("tests")) {
    if (entry.isFile && entry.name.endsWith("-probe.txt")) {
      probes.push(entry.name.replace(/-probe\.txt$/, ""));
    }
  }
  console.error(
    `Usage: deno task probe <name>   (one of: ${probes.sort().join(", ")})`,
  );
  Deno.exit(1);
}
const input = join(
  "tests",
  `${name.replace(/\.txt$/i, "").replace(/-probe$/i, "")}-probe.txt`,
);
try {
  await Deno.stat(input);
} catch {
  console.error(`No probe source at ${input}`);
  Deno.exit(1);
}

const sanny = Deno.env.get("SANNY") || "sanny.exe";
const vc = Deno.env.get("VC");
if (!vc) {
  console.error("Set VC in .env to your Vice City installation directory.");
  Deno.exit(1);
}

// Compile next to the source; sanny.exe resolves relative paths against its own folder
const source = resolve(input);
const scm = source.replace(/\.txt$/i, ".scm");
const startedAt = Date.now();
const compiled = await new Deno.Command(sanny, {
  args: ["--no-splash", "--mode", "vc_sbl", "--compile", source, scm],
}).output();
const output = await Deno.stat(scm).catch(() => null);
if (!compiled.success || !output?.mtime || output.mtime.getTime() < startedAt) {
  console.error(`Compile failed for ${input}`);
  Deno.exit(1);
}
console.log(`Compiled ${basename(scm)}`);

// Find every installed main script
const installed: string[] = [join(vc, "data", "main.scm")];
const modloaderDir = join(vc, "modloader");
try {
  for await (const entry of Deno.readDir(modloaderDir)) {
    if (entry.isDirectory) {
      installed.push(join(modloaderDir, entry.name, "data", "main.scm"));
    }
  }
} catch {
  // No modloader folder
}

// Move them aside
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = join(vc, ".main-backup", stamp);
const moved: { from: string; to: string }[] = [];
for (const path of installed) {
  try {
    await Deno.stat(path);
  } catch {
    continue;
  }
  const dest = join(backupDir, relative(vc, path));
  await Deno.mkdir(dirname(dest), { recursive: true });
  await Deno.rename(path, dest);
  moved.push({ from: path, to: dest });
  console.log(`Moved ${relative(vc, path)} to ${relative(vc, dest)}`);
}

// Move the previous run's output aside so the findings only hold this run
const probeName = basename(input).replace(/-probe\.txt$/i, "");
const probeIni = join(vc, `${probeName}-probe.ini`);
try {
  await Deno.stat(probeIni);
  await Deno.rename(probeIni, join(backupDir, `${probeName}-probe.ini`));
  console.log(`Moved stale ${probeName}-probe.ini to the backup`);
} catch {
  // No earlier output
}

// Install the probe as the only main script
const mainPath = join(vc, "data", "main.scm");
await Deno.copyFile(scm, mainPath);
console.log("Installed data/main.scm");

// Launch the game and wait for it to exit
const exe = join(vc, "gta-vc.exe");
console.log(`Launching ${exe}, waiting for the game to exit`);
const launchedAt = Date.now();
let exitCode = -1;
try {
  exitCode = (await new Deno.Command(exe, { cwd: vc }).spawn().status).code;
} finally {
  // Keep the probe's main next to the backups, then put every original back
  await Deno.rename(mainPath, join(backupDir, "probe-main.scm"));
  for (const { from, to } of moved) {
    await Deno.mkdir(dirname(from), { recursive: true });
    await Deno.rename(to, from);
    console.log(`Restored ${relative(vc, from)}`);
  }
}
const seconds = Math.round((Date.now() - launchedAt) / 1000);

// Log the findings
const readOrEmpty = async (path: string) => {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return "";
  }
};
const cleoLog = await readOrEmpty(join(vc, "cleo.log"));
const scrLog = await readOrEmpty(join(vc, "scrlog.log"));
const ini = (await readOrEmpty(probeIni)).trim();
const problems = (text: string) =>
  text.split(/\r?\n/).filter((line) =>
    /incorrect|error|fail|invalid|unknown/i.test(line)
  ).slice(-20);
const block = (lines: string[]) => lines.length ? lines.join("\n") : "(none)";

const scrClean = /Logging finished/.test(scrLog);

// A probe key named `..._expect_N` (or `_expect_minusN`) states the value the game should write
const failures: string[] = [];
if (!scrClean) failures.push("SCRLog footer missing (likely a crash)");
for (const line of ini.split(/\r?\n/)) {
  const match = line.match(/^(.*_expect_(minus)?(\d+))=(-?\d+)\s*$/);
  if (!match) continue;
  const expected = (match[2] ? -1 : 1) * Number(match[3]);
  if (Number(match[4]) !== expected) {
    failures.push(`${match[1]}: wrote ${match[4]}`);
  }
}
const passed = failures.length === 0;

const report = `# Probe: ${probeName}

| Field | Value |
| --- | --- |
| Result | ${passed ? "pass" : "fail"} |
| Started | ${stamp} |
| Duration | ${seconds} s |
| Exit code | ${exitCode} |
| SCRLog footer | ${scrClean ? "present" : "missing (likely a crash)"} |
| Backups | ${relative(vc, backupDir)} |

## Failures

\`\`\`
${block(failures)}
\`\`\`

## Probe Output

\`\`\`ini
${ini || "(no output file)"}
\`\`\`

## CLEO Problems

\`\`\`
${block(problems(cleoLog))}
\`\`\`

## SCRLog Tail

\`\`\`
${scrLog.split(/\r?\n/).slice(-30).join("\n")}
\`\`\`
`;
await Deno.mkdir(join("tests", "results"), { recursive: true });
const reportPath = join("tests", "results", `${probeName}-${stamp}.md`);
await Deno.writeTextFile(reportPath, report);
console.log(`Findings written to ${reportPath}`);
if (passed) {
  console.log("Probe passed");
} else {
  console.error("Probe failed");
  for (const failure of failures) console.error(`  ${failure}`);
  Deno.exitCode = 1;
}
