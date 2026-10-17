# Voice Audit Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the misspelled word and the miscapitalized mission titles found in the voice audit, and keep the voice inventory in step with `main.txt`.

**Architecture:** `main.txt` is not valid UTF-8, so the Edit and Write tools refuse it. A short Deno script replaces ASCII byte sequences and leaves every other byte alone. The inventory CSV is plain UTF-8 and takes ordinary edits.

**Tech Stack:** Deno, grep, Sanny Builder 4.2.0 (the user compiles the script).

**Spec:** [docs/voice.md](../../docs/voice.md) is the audit. [docs/voice.csv](../../docs/voice.csv) is the inventory. [docs/branding.md](../../docs/branding.md) sets the title case rule.

## Global Constraints

- US English and the Oxford comma in every document and string.
- Title case for every heading and every mission title.
- No em dashes in any text.
- No file is deleted. `git commit` is never run without the user's written permission, so this plan has no commit steps.
- Shell commands use paths relative to the repository root.
- Vehicle names that match the GTA Vice City game data stay as they are, including "Perrenial", "Pheonix", and "Sanbre Turbo".
- Every replacement keeps the line count unchanged, so the line numbers in [docs/voice.csv](../../docs/voice.csv) stay valid.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `main.txt` | The script. Task 1 and Task 2 change string literals in it. |
| `docs/voice.csv` | The string inventory. Task 3 syncs three rows with the script. |
| `docs/voice.md` | The audit. No change. |

## Task 1: Fix the Trespassing Misspelling

The vehicle names "Perrenial", "Pheonix", and "Sanbre Turbo" in the delivery strings are not changed. They follow the names in the GTA Vice City game data, which ships "Pheonix" as written.

**Files:**
- Modify: `main.txt:1624`

**Interfaces:**
- Consumes: nothing.
- Produces: the word "trespassing" in `main.txt`. Task 3 copies it into the CSV.

- [ ] **Step 1: Show that the misspelling exists**

Run: `grep -c "tresspassing" main.txt`
Expected: `1`.

- [ ] **Step 2: Replace the string byte by byte**

```bash
deno eval '
const pairs = [
  ["tresspassing", "trespassing"],
];
const enc = new TextEncoder();
let data = await Deno.readFile("main.txt");
for (const [from, to] of pairs) {
  const f = enc.encode(from);
  const t = enc.encode(to);
  const out = [];
  let n = 0;
  for (let i = 0; i < data.length;) {
    if (data[i] === f[0] && f.every((b, k) => data[i + k] === b)) {
      for (const b of t) out.push(b);
      i += f.length;
      n++;
    } else {
      out.push(data[i++]);
    }
  }
  console.log(from, "->", to, n);
  data = Uint8Array.from(out);
}
await Deno.writeFile("main.txt", data);
'
```

Expected: one line ending in `1`.

- [ ] **Step 3: Show that the string is corrected**

Run: `grep -c "tresspassing" main.txt; grep -c "trespassing" main.txt`
Expected: `0` and `1`.

## Task 2: Fix Mission Title Capitalization

**Files:**
- Modify: `main.txt:1199`, `main.txt:1290`

**Interfaces:**
- Consumes: the Task 1 script pattern. Run it again with new pairs.
- Produces: the titles "Behind the Mask, Another Mask!" and "The End Is Simply the Beginning...". Task 3 copies them into the CSV.

- [ ] **Step 1: Show that the old titles exist**

Run: `grep -c '"Behind The Mask, Another Mask!"' main.txt; grep -c '"The End Is Simply The Beginning..."' main.txt`
Expected: `1` and `1`.

- [ ] **Step 2: Replace the strings**

Run the script from Task 1, Step 2, with this `pairs` array in place of the first one:

```js
const pairs = [
  ["\"Behind The Mask, Another Mask!\"", "\"Behind the Mask, Another Mask!\""],
  ["\"The End Is Simply The Beginning...\"", "\"The End Is Simply the Beginning...\""],
];
```

Expected: two lines, each ending in `1`.

- [ ] **Step 3: Show that the titles are corrected**

Run: `grep -c '"Behind The Mask' main.txt; grep -c 'Simply The Beginning' main.txt`
Expected: `0` and `0`.

Run: `grep -c '"Behind the Mask, Another Mask!"' main.txt; grep -c '"The End Is Simply the Beginning..."' main.txt`
Expected: `1` and `1`.

- [ ] **Step 4: Compile in Sanny Builder**

Open `main.txt` in Sanny Builder 4.2.0 and compile it. The user runs this step, because the compiler is in the user's environment. Expected: no compile errors. The title cards show the new text in game.

## Task 3: Sync the Voice Inventory

**Files:**
- Modify: `docs/voice.csv:5`, `docs/voice.csv:8`, `docs/voice.csv:13` (rows for source lines 1199, 1290, and 1624)

**Interfaces:**
- Consumes: the strings from Task 1 and Task 2.
- Produces: an inventory whose text and flags match `main.txt`.

- [ ] **Step 1: Show that the rows are out of date**

Run: `grep -n "^1199,\|^1290,\|^1624," docs/voice.csv`
Expected: three rows. The 1199 and 1290 rows end in `capitalization`. The 1624 row contains `tresspassing` and the flag `typo`.

- [ ] **Step 2: Edit the 1199 row**

Replace `1199,Boss,Mission title,System,"Behind The Mask, Another Mask!",exclamation;capitalization` with `1199,Boss,Mission title,System,"Behind the Mask, Another Mask!",exclamation`.

- [ ] **Step 3: Edit the 1290 row**

Replace `1290,End,Mission title,System,"The End Is Simply The Beginning...",ellipsis;capitalization` with `1290,End,Mission title,System,"The End Is Simply the Beginning...",ellipsis`.

- [ ] **Step 4: Edit the 1624 row**

Replace `1624,Bathe,Help text,Narrator,"Maybe next time, you'll think twice before tresspassing, eh?",typo;direct-address;contraction` with `1624,Bathe,Help text,Narrator,"Maybe next time, you'll think twice before trespassing, eh?",direct-address;contraction`.

- [ ] **Step 5: Show that the inventory is current**

Run: `grep -c "capitalization\|typo\|tresspassing\|Simply The\|Behind The" docs/voice.csv`
Expected: `0`.

## Pending Decisions

These items need an answer from the author before any work can start. Each one names the file that records the answer. None of them is a task until the author decides.

1. **Narration and dialogue rules.** [docs/branding.md](../../docs/branding.md) leaves these **Open**. The answer goes in its "Narration and Dialogue Style" section.
2. **The Barrier claims.** Decide whether "you cannot die while inside it" is true, false, or a lie the narrator tells. The answer becomes a new row in [docs/lore.csv](../../docs/lore.csv). The death and bust handling in `main.txt` bears on it. See `.agents/bugs/death-and-bust-hazards.md`.
3. **Who speaks the late text.** The Fairy and the opening narrator need a source in the story. Each becomes a character row in [docs/lore.csv](../../docs/lore.csv) once Book 2 is available. This extends row L010.
4. **Joke handling.** Decide whether the announced jokes stay, change, or move to events. The answer goes in the "Dark Comedy" section of [docs/branding.md](../../docs/branding.md), and the affected strings are the rows in [docs/voice.csv](../../docs/voice.csv) for source lines 1620, 1622, 7858, 9378, and 9684.
5. **GXT file.** Add the GXT source to the repository, then extend [docs/voice.csv](../../docs/voice.csv) with the 219 keyed strings.
6. **Speaker labels.** Decide whether dialogue prints a speaker name. A yes changes every dialogue `Text.PrintString` and `Text.PrintStringNow` call in the Cart, BossDie, and Fairy scripts.

## Self-Review

- **Spec coverage:** the one misspelling line and the two title lines in [docs/voice.md](../../docs/voice.md) map to Task 1 and Task 2. The inventory sync maps to Task 3. The six open items map to Pending Decisions.
- **Placeholder scan:** no step uses "TBD", "TODO", or "similar to". Task 2 reuses the Task 1 script and shows its own `pairs` array.
- **Name consistency:** the corrected strings are spelled the same way in Task 1, Task 2, and Task 3.
