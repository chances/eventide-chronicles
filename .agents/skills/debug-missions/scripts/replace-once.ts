// Replaces one exact block of text in a file and keeps every other byte unchanged.
// Usage: deno run --allow-read --allow-write replace-once.ts <target> <from.txt> <to.txt>
// The from and to files hold the text with LF endings. The script converts them to CRLF
// when the target uses CRLF. It stops unless the from text occurs exactly once.
const [target, fromPath, toPath] = Deno.args;
if (!target || !fromPath || !toPath) {
  console.error("Usage: replace-once.ts <target> <from.txt> <to.txt>");
  Deno.exit(1);
}

const toBinary = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

const file = toBinary(await Deno.readFile(target));
const usesCrlf = file.includes("\r\n");
const eol = (text: string) => (usesCrlf ? text.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n") : text);
const from = eol(toBinary(await Deno.readFile(fromPath)));
const to = eol(toBinary(await Deno.readFile(toPath)));

const first = file.indexOf(from);
if (first === -1 || file.indexOf(from, first + 1) !== -1) {
  console.error("The from text must occur exactly once in the target.");
  Deno.exit(1);
}

const result = file.slice(0, first) + to + file.slice(first + from.length);
const out = new Uint8Array(result.length);
for (let i = 0; i < result.length; i++) out[i] = result.charCodeAt(i);
await Deno.writeFile(target, out);
console.log(`Replaced one block in ${target}`);
