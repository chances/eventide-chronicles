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
| `lib/threads/bath.txt` | The Bathe help text. Task 1 changes the misspelling in it. |
| `main.txt` | The script. Task 2 changes the mission title literals in it. |
| `docs/voice.csv` | The string inventory. Task 3 syncs three rows with the script. |
| `docs/voice.md` | The audit. No change. |

## Task 1: Fix the Trespassing Misspelling

The vehicle names "Perrenial", "Pheonix", and "Sanbre Turbo" in the delivery strings are not changed. They follow the names in the GTA Vice City game data, which ships "Pheonix" as written.

**Files:**
- Modify: `lib/threads/bath.txt:32`

**Interfaces:**
- Consumes: nothing.
- Produces: the word "trespassing" in `lib/threads/bath.txt`. Task 3 copies it into the CSV.

- [x] **Step 1: Show that the misspelling exists**

Run: `grep -c "tresspassing" lib/threads/bath.txt`
Expected: `1`.

- [x] **Step 2: Replace the string byte by byte**

```bash
deno eval '
const pairs = [
  ["tresspassing", "trespassing"],
];
const enc = new TextEncoder();
let data = await Deno.readFile("lib/threads/bath.txt");
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
await Deno.writeFile("lib/threads/bath.txt", data);
'
```

Expected: one line ending in `1`.

- [x] **Step 3: Show that the string is corrected**

Run: `grep -c "tresspassing" lib/threads/bath.txt; grep -c "trespassing" lib/threads/bath.txt`
Expected: `0` and `1`.

## Task 2: Fix Mission Title Capitalization

**Files:**
- Modify: `main.txt:245`, `main.txt:340`

**Interfaces:**
- Consumes: the Task 1 script pattern. Run it again on `main.txt` with new pairs.
- Produces: the titles "Behind the Mask, Another Mask!" and "The End Is Simply the Beginning...". Task 3 copies them into the CSV.

- [x] **Step 1: Show that the old titles exist**

Run: `grep -c '"Behind The Mask, Another Mask!"' main.txt; grep -c '"The End Is Simply The Beginning..."' main.txt`
Expected: `1` and `1`.

- [x] **Step 2: Replace the strings**

Run the script from Task 1, Step 2, with `main.txt` in place of `lib/threads/bath.txt` and this `pairs` array in place of the first one:

```js
const pairs = [
  ["\"Behind The Mask, Another Mask!\"", "\"Behind the Mask, Another Mask!\""],
  ["\"The End Is Simply The Beginning...\"", "\"The End Is Simply the Beginning...\""],
];
```

Expected: two lines, each ending in `1`.

- [x] **Step 3: Show that the titles are corrected**

Run: `grep -c '"Behind The Mask' main.txt; grep -c 'Simply The Beginning' main.txt`
Expected: `0` and `0`.

Run: `grep -c '"Behind the Mask, Another Mask!"' main.txt; grep -c '"The End Is Simply the Beginning..."' main.txt`
Expected: `1` and `1`.

- [ ] **Step 4: Compile in Sanny Builder**

Open `main.txt` in Sanny Builder 4.2.0 and compile it. The user runs this step, because the compiler is in the user's environment. Expected: no compile errors. The title cards show the new text in game.

## Task 3: Sync the Voice Inventory

**Files:**
- Modify: `docs/voice.csv:5`, `docs/voice.csv:8`, `docs/voice.csv:13` (rows for source lines 217, 312, and 32)

**Interfaces:**
- Consumes: the strings from Task 1 and Task 2.
- Produces: an inventory whose text and flags match `main.txt`.

- [x] **Step 1: Show that the rows are out of date**

Run: `grep -n "^217,\|^312,\|^32," docs/voice.csv`
Expected: three rows. The 217 and 312 rows end in `capitalization`. The 32 row contains `tresspassing` and the flag `typo`.

- [x] **Step 2: Edit the 217 row**

Replace `217,Boss,Mission title,System,"Behind The Mask, Another Mask!",exclamation;capitalization,main.txt` with `217,Boss,Mission title,System,"Behind the Mask, Another Mask!",exclamation,main.txt`.

- [x] **Step 3: Edit the 312 row**

Replace `312,End,Mission title,System,The End Is Simply The Beginning...,ellipsis;capitalization,main.txt` with `312,End,Mission title,System,The End Is Simply the Beginning...,ellipsis,main.txt`.

- [x] **Step 4: Edit the 32 row**

Replace `32,Bathe,Help text,Narrator,"Maybe next time, you'll think twice before tresspassing, eh?",typo;direct-address;contraction,lib/threads/bath.txt` with `32,Bathe,Help text,Narrator,"Maybe next time, you'll think twice before trespassing, eh?",direct-address;contraction,lib/threads/bath.txt`.

- [x] **Step 5: Show that the inventory is current**

Run: `grep -c "capitalization\|typo\|tresspassing\|Simply The\|Behind The" docs/voice.csv`
Expected: `0`.

## Task 4: Record the New Canon in the Ledger

**Files:**
- Modify: `docs/lore.csv` (append rows L029 to L033)

**Interfaces:**
- Consumes: the Pending Decisions answers for the Barrier, the Fairy, the narrator, Toni's coma, and the tense departure.
- Produces: five ledger rows that the later voice and lore work cites.

- [x] **Step 1: Check the spoiler document**

Read [docs/spoilers.md](../../docs/spoilers.md). Confirm that the coma and the deluded narrator rows do not state or hint at the hidden premise. Stop and ask if they do.

- [x] **Step 2: Append the five rows**

```csv
L029,World and Setting,Barrier: the player cannot die inside it and dies only when leaving,Mod,Grilling decision,,Verify against lib/threads/barrier.txt lines 212 and 224
L030,Characters,The Fairy is a mod-only character,Mod,Grilling decision,,Character row that extends L010
L031,Tone and Narration,The opening narrator is a deluded god and unreliable throughout,Mod,Grilling decision,,Believes its account is authoritative on the story; extends L006
L032,Characters,Toni Mueller is in a coma,Mod,Grilling decision,,Extends L023
L033,Relationship to Book 2,Narration uses third person past while Book 2 switches tenses,Mod,Grilling decision,Book 2 switches tenses between chapters,Style departure from Book 2 recorded under L003
```

Expected: `docs/lore.csv` has 33 data rows and every row has seven fields.

## Pending Decisions

Each item is marked **Decided**, **Open**, or **Deferred**. Each one names the file that records the answer. An Open item is not a task until the author decides it.

1. **Narration and dialogue rules.** **Decided:** separate rules for narration and dialogue, in the "Narration and Dialogue Style" section of [docs/branding.md](../../docs/branding.md). Narration uses third person past, consistent across the game. Dialogue stays in character. Help text fits on one line.
2. **The Barrier claims.** **Decided:** "you cannot die while inside it" is true. The player dies only when leaving the barrier, through the `Player.ExplodeHead` calls in `lib/threads/barrier.txt` at lines 212 and 224. Record a new row in [docs/lore.csv](../../docs/lore.csv). See `.agents/bugs/death-and-bust-hazards.md`.
3. **Who speaks the late text.** **Decided:** the Fairy is a mod-only character, recorded as a new character row in [docs/lore.csv](../../docs/lore.csv) marked Mod. **Decided:** the opening narrator is a deluded god. It believes it is authoritative on the story, and it is unreliable throughout. **Decided:** Toni is in a coma, which is new canon to record as Mod in [docs/lore.csv](../../docs/lore.csv). The Book 2 draft, [docs/Turning_Darkness_Into.epub](../../docs/Turning_Darkness_Into.epub), is untracked, has eight drafted chapters, and names neither character. This extends row L010.
4. **Joke handling.** **Decided:** the Poseidon help text and the "right tool for the wrong job" line are tongue-in-cheek and stay. The wooden sticks line is not a joke in the narrator's eyes and stays. The Popemobile line is misclassified, because a character (Toni) says it. **Decided:** amend the branding rule so the narration may be tongue-in-cheek, and it still never announces a joke. The source rows are in the "Dark Comedy" section of [docs/voice.md](../../docs/voice.md). The amended rule goes in [docs/branding.md](../../docs/branding.md), which has no "Dark Comedy" section yet.
5. **GXT file.** **Deferred:** the GXT inventory is tracked separately. `strings.fxt` in the repository root holds 7 keyed strings, and the 219-string source is not in the repository.
6. **Speaker labels.** **Decided:** dialogue prints no speaker name. The `Text.PrintString` and `Text.PrintStringNow` calls in the Cart, BossDie, and Fairy scripts stay as they are.

## Self-Review

- **Spec coverage:** the one misspelling line and the two title lines in [docs/voice.md](../../docs/voice.md) map to Task 1 and Task 2. The inventory sync maps to Task 3. The six open items map to Pending Decisions.
- **Placeholder scan:** no step uses "TBD", "TODO", or "similar to". Task 2 reuses the Task 1 script and shows its own `pairs` array.
- **Name consistency:** the corrected strings are spelled the same way in Task 1, Task 2, and Task 3.
