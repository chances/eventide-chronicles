import { assert, assertEquals } from "@std/assert";
import { exists } from "@std/fs/exists";
import { walk } from "@std/fs/walk";
import { join } from "@std/path";

// Checks the mission lock contract: the shared guard, acquire, and release
// subroutines in lib/mission-lock.txt, the globals they use in lib/alloc.txt,
// the startup value in lib/init.txt, and the one engine mission flag in
// main.txt.

const root = join(import.meta.dirname!, "..");
const decoder = new TextDecoder("windows-1252");

async function read(path: string): Promise<string> {
  const bytes = await Deno.readFile(join(root, path));
  return decoder.decode(bytes).replace(/\r\n/g, "\n");
}

// Every script source: main.txt plus the files under lib/ and missions/. A
// mission with an `.fsm.json` sibling is a Mission Foundry conversion that
// main.txt does not include, so it is skipped.
async function readSources(): Promise<Map<string, string>> {
  const sources = new Map([["main.txt", await read("main.txt")]]);
  for (const dir of ["lib", "missions"]) {
    for await (const entry of walk(join(root, dir), { exts: [".txt"] })) {
      if (await exists(entry.path.replace(/\.txt$/, ".fsm.json"))) continue;
      const path = entry.path.slice(root.length + 1).replaceAll("\\", "/");
      sources.set(path, await read(path));
    }
  }
  return sources;
}

// The code lines of a label: everything after `:Label` up to the next label,
// without blank lines and comments.
function labelBody(source: string, label: string): string[] {
  const lines = source.split("\n");
  const start = lines.indexOf(`:${label}`);
  assert(start !== -1, `no label :${label}`);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^:\w/.test(line)) break;
    const code = line.trim();
    if (code && !code.startsWith("//")) body.push(code);
  }
  return body;
}

const sources = await readSources();
const lock = sources.get("lib/mission-lock.txt")!;
const alloc = sources.get("lib/alloc.txt")!;
const init = sources.get("lib/init.txt")!;
const main = sources.get("main.txt")!;

Deno.test("the guard label ends any thread that falls into it", () => {
  assertEquals(labelBody(lock, "MissionLock_Guard"), ["terminate_this_script"]);
});

Deno.test("main.txt includes the lock routines once", () => {
  assertEquals(main.split("{$INCLUDE lib/mission-lock.txt}").length - 1, 1);
});

Deno.test("acquire tests the lock and then sets it with no wait between", () => {
  const acquire = labelBody(lock, "AcquireMissionLock");
  const tested = acquire.indexOf("$MissionLocked == false");
  const set = acquire.indexOf("$MissionLocked = true");
  const otherwise = acquire.indexOf("else");
  assert(tested !== -1, "acquire never tests $MissionLocked == false");
  assert(set > tested, "acquire sets the lock before it tests it");
  assert(otherwise > set, "the set is not in the granted branch");
  assertEquals(acquire.filter((line) => /^wait\b/.test(line)), []);
  assertEquals(acquire.at(-1), "return");
});

Deno.test("acquire reports the result in $MissionLockGranted", () => {
  const acquire = labelBody(lock, "AcquireMissionLock");
  const set = acquire.indexOf("$MissionLocked = true");
  const granted = acquire.indexOf("$MissionLockGranted = true");
  const busy = acquire.indexOf("$MissionLockGranted = false");
  assert(granted > set, "granted is reported before the lock is set");
  assert(busy > acquire.indexOf("else"), "busy is not reported in the else");
  assertEquals(acquire.filter((line) => /\b(?!15@)\d+@/.test(line)), []);
});

Deno.test("only the lock routines use 15@, their trace scratch", () => {
  const users = [...sources]
    .filter(([path, text]) =>
      path !== "lib/mission-lock.txt" && /\b15@/.test(text)
    )
    .map(([path]) => path);
  assertEquals(users, []);
});

Deno.test("release clears the lock without checking an owner", () => {
  const release = labelBody(lock, "ReleaseMissionLock");
  assert(release.includes("$MissionLocked = false"));
  assertEquals(release.filter((line) => /\b(?!15@)\d+@/.test(line)), []);
  assertEquals(
    release.filter((line) => /^if\b/.test(line) && line !== "if DebugTrace"),
    [],
  );
  assertEquals(release.at(-1), "return");
});

for (
  const [label, word] of [
    ["AcquireMissionLock", "acquire"],
    ["ReleaseMissionLock", "release"],
  ]
) {
  Deno.test(`${word} writes a DebugTrace record with the game time`, () => {
    const body = labelBody(lock, label);
    const trace = body.indexOf("if DebugTrace");
    assert(trace !== -1, `${word} has no DebugTrace guard`);
    assert(
      body.some((line) =>
        line.startsWith("IniFile.WriteString(") && line.includes(`"${word}"`)
      ),
      `${word} writes no trace record named ${word}`,
    );
    assert(
      body.some((line) => line.includes("Clock.GetGameTimer(")),
      `${word} records no game time`,
    );
    const set = body.findIndex((line) => line.startsWith("$MissionLocked ="));
    assert(trace > set, `${word} traces before it sets the lock`);
  });
}

Deno.test("declare_mission_flag names $MissionLocked, once", () => {
  const declarations = [...sources].flatMap(([path, text]) =>
    text.split("\n")
      .filter((line) => line.trim().startsWith("declare_mission_flag"))
      .map((line) => `${path}: ${line.trim()}`)
  );
  assertEquals(declarations, ["main.txt: declare_mission_flag $MissionLocked"]);
});

Deno.test("alloc.txt holds the globals the lock uses", () => {
  assert(alloc.includes("Alloc($MissionLockGranted, 8905)"));
  assert(alloc.includes("Alloc($MissionLocked, 8907)"));
});

Deno.test("startup sets the lock to false before mission 0 launches", () => {
  assert(init.includes("$MissionLocked = false"));
  const included = main.indexOf("{$INCLUDE lib/init.txt}");
  const launched = main.indexOf("Mission.LoadAndLaunchInternal(0)");
  assert(included !== -1 && launched > included);
});

for (const name of ["$ONMISSION", "$MissionLock", "$MissionTimer"]) {
  Deno.test(`${name} appears in no script source`, () => {
    const pattern = new RegExp(`${name.replace("$", "\\$")}\\b`, "i");
    const offenders = [...sources]
      .filter(([, text]) => pattern.test(text))
      .map(([path]) => path);
    assertEquals(offenders, []);
  });
}
