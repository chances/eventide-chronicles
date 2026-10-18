// Reports labels whose last statement can fall into the next label when that label
// is a thread entry (followed by script_name) or a subroutine (gosub or call target).
const path = Deno.args[0];
const bytes = await Deno.readFile(path);
const text = new TextDecoder("windows-1252").decode(bytes);
const lines = text.split(/\r?\n/);

type Label = { name: string; line: number; first: string; last: string; lastLine: number };
const labels: Label[] = [];
let cur: Label | null = null;
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i].replace(/\/\/.*$/, "").trim();
  if (raw === "") continue;
  const m = raw.match(/^:(\w+)/);
  if (m) {
    cur = { name: m[1], line: i + 1, first: "", last: "", lastLine: i + 1 };
    labels.push(cur);
    continue;
  }
  if (cur) {
    if (cur.first === "") cur.first = raw;
    cur.last = raw;
    cur.lastLine = i + 1;
  }
}

const names = new Set(labels.map((l) => l.name.toLowerCase()));
const subs = new Set<string>();
for (const raw of lines) {
  const s = raw.replace(/\/\/.*$/, "");
  for (const m of s.matchAll(/gosub\s+@(\w+)/gi)) subs.add(m[1].toLowerCase());
  for (const m of s.matchAll(/(?:^|\s)(\w+)\(\)\s*$/g)) {
    if (names.has(m[1].toLowerCase())) subs.add(m[1].toLowerCase());
  }
}

const terminator = /^(goto\s|terminate_this_script|terminate_all_scripts|return\b|cleo_return)/i;
let count = 0;
for (let i = 0; i < labels.length - 1; i++) {
  const l = labels[i];
  const next = labels[i + 1];
  if (l.last === "" || terminator.test(l.last)) continue;
  const intoThread = /^script_name\b/i.test(next.first);
  const intoSub = subs.has(next.name.toLowerCase());
  if (!intoThread && !intoSub) continue;
  count++;
  console.log(
    `${l.name} (line ${l.line}) ends at line ${l.lastLine} with "${l.last}" and falls into ${next.name} (line ${next.line}) [${intoThread ? "thread" : "subroutine"}]`,
  );
}
console.log(`total: ${count}`);
