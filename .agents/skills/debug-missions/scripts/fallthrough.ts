// Reports labels whose last statement can fall into the next label when that label
// is a thread entry (followed by script_name) or a subroutine (gosub or call target).
// Takes one or more paths. Each {$INCLUDE} line whose path is also an argument is
// expanded in place, so the lines run in include order. Arguments not reached that way
// are appended in argument order. Each line is tagged with its file and line number.
const sources = new Map<string, string[]>();
for (const path of Deno.args) {
  const bytes = await Deno.readFile(path);
  sources.set(path, new TextDecoder("windows-1252").decode(bytes).split(/\r?\n/));
}
const lines: string[] = [];
const origin: string[] = [];
const emitted = new Set<string>();
const emit = (path: string) => {
  if (emitted.has(path)) return;
  emitted.add(path);
  sources.get(path)!.forEach((text, i) => {
    const include = text.match(/^\{\$INCLUDE (.+)\}\s*$/);
    if (include && sources.has(include[1])) emit(include[1]);
    else {
      lines.push(text);
      origin.push(`${path}:${i + 1}`);
    }
  });
};
Deno.args.forEach(emit);

type Label = { name: string; at: string; first: string; last: string; lastAt: string };
const labels: Label[] = [];
let cur: Label | null = null;
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i].replace(/\/\/.*$/, "").trim();
  if (raw === "") continue;
  const m = raw.match(/^:(\w+)/);
  if (m) {
    cur = { name: m[1], at: origin[i], first: "", last: "", lastAt: origin[i] };
    labels.push(cur);
    continue;
  }
  if (cur) {
    if (cur.first === "") cur.first = raw;
    cur.last = raw;
    cur.lastAt = origin[i];
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
    `${l.name} (${l.at}) ends at ${l.lastAt} with "${l.last}" and falls into ${next.name} (${next.at}) [${intoThread ? "thread" : "subroutine"}]`,
  );
}
console.log(`total: ${count}`);
