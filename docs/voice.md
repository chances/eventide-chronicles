# Voice

This document records the tone of the dialog and narrative text that exists in `main.txt` today, and compares it with the target voice in [branding.md](branding.md). The line-by-line inventory is [voice.csv](voice.csv). Story decisions live in [lore.md](lore.md) and [lore.csv](lore.csv).

Status: Draft. Items marked **Open** await a decision from the author.

## Scope and Method

The audit covers every string that `main.txt` passes to a `Text.*String*` command. These are the strings written inline in the script. Strings called by a GXT key, such as `'CLOHELP'` or `'PACKHL1'`, live in a GXT file that is not in this repository. They are **Open** until that file is added.

- Inline text calls: 185.
- Vehicle delivery strings ("[Vehicle] Delivered!"): 80.
- Other inline text calls: 105.
- Inline text calls that contain "!": 126, of which 46 are not delivery strings.
- Text calls by GXT key, with the text not visible: 219.
- Inline strings with profanity: 5.
- Uses of the word "Episode": 0.

The `speaker` column in [voice.csv](voice.csv) is inferred from the order of the calls and the script around them. The script never labels a speaker. Rows marked `Unknown` have no clear speaker.

## The Current Voice

### Surfaces

The text appears on five surfaces. Each one has its own habits.

- **Mission titles** are seven big-text cards. Five of the seven end in an ellipsis, and the titles are puns or reversals, such as "Model Citizens Get Stitches..." and "The End Is Simply The Beginning...".
- **Opening narration** is twelve sentences in `:INIT`. It addresses the player as "you", explains the Barrier, and ends with a warning.
- **Dialogue** is printed as plain subtitles with no speaker name. Three scenes carry it: the Boss in the Cart mission, the Daughter in the bike ride, and the Boss again in the BossDie confrontation. A Fairy speaks two lines at the start of the late arc.
- **Help text and objectives** are short imperatives, such as "Go home." and "Get back to the Hardware Store and pay for the Hammer."
- **Feedback strings** are the vehicle, tool, and failure messages. Most end in "!".

### Observed Traits

- **Register is mixed.** The opening narration is formal, with words such as "indubitably", "heed", and "fraught". The dialogue is colloquial and uses contractions, interjections, and profanity.
- **Person shifts by surface.** Narration and objectives use second person. One help text switches to first person: "I'd be on the lookout for golf-ball sized hail or a biblical plague soon."
- **Jokes are stated.** Several lines are written as jokes inside the text. Examples are the wooden sticks line in the opening narration, "No, it's the Popemobile. Yes, this is your bike.", and "Come back any time you need the right tool for the wrong job."
- **Violence and loss are spoken, not narrated.** The Boss states what happened to the client's daughter in one line: "I know what you did with our client's daughter!" The scene shows no narration of the event.
- **Exclamation marks are the default.** 46 of the 105 non-delivery strings use one, as do all 80 delivery strings.
- **Characters have role names only.** The text names "Boss", "Daughter", and "Fairy". No character has a personal name in the inline text.
- **The Barrier is the one built idea.** The opening narration claims a prophecy of 5 tasks, a protective Barrier, and that "you cannot die while inside it". The script gives no second account of these claims.

## Comparison With Branding

[branding.md](branding.md) defines the voice attributes. The comparison below sets each attribute's written rule next to the text in [voice.csv](voice.csv).

### Grim

- **Branding rule:** dark events are stated plainly and are not dwelt on for effect.
- **In the text:** the Boss states the event in one line ("I know what you did with our client's daughter!"). The failure string "You killed the client's daughter!" ends in "!", as does "Mission Failed!".

### Restrained

- **Branding rule:** narration states what happened and leaves the feeling to the player. The model line is "Her hands were steady. Nobody asked why."
- **In the text:** 126 of 185 inline strings contain "!". The Fairy lines, "Greetings, child." and "We have been waiting so long for your arrival...", contain none.

### Unreliable

- **Branding rule:** each unreliable account has a discoverable truth or a clear reason it is false.
- **In the text:** the opening narrator asserts that the player cannot die inside the Barrier. The script has no second account of this claim. The ledger records the Barrier rule in [lore.csv](lore.csv) row L029 and the narrator's unreliability in row L031.

### Dark Comedy

- **Branding rule:** the comedy comes from events, and the narration never announces a joke.
- **In the text, announced:** the Poseidon help text, the wooden sticks line, the Popemobile line, and the "right tool for the wrong job" line each state the joke in the narration or in a character's line.
- **In the text, event-driven:** the Cart mission sets up a Boss who threatens the Player and a Daughter who asks for a ride. The reader can see the collapse coming.

### System Text

- **Branding rule:** the grim register applies, and no humor is planned.
- **In the text:** the shopkeeper help texts ("Didn't your mother teach you that stealing is wrong!?") and the 80 delivery strings carry an exclamation mark and, in the shopkeeper's case, a joke.

## Follow-Up Work

The text fixes from the audit are applied. The GXT file remains **Open** until it is added to the repository (see [Scope and Method](#scope-and-method)).
