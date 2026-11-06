# Case Study: Overthinking Simple Fixes

**Date:** 2026-11-06\
**Branch:** `fix/mutual-exclusion`\
**Cost:** Extreme user frustration, 25 documented frustration signals, 6
consecutive churn rounds over a single CSS property at `chart.css:524`, and
multiple rule violations.

## The Instruction

The user gave the following instruction at 2026-11-06T20:57:56Z:

> "Marks go between lines, not on them. Marks split story beats (make this clear
> in AGENTS.md and the mission charts epic/plan docs), so make the hover/preview
> state for \"Add Mark\" clear where the division would go"

## What Actually Happened (Turn by Turn)

1. **Initial Misstep (2026-11-06T21:08:34Z, Step 1154)**: The agent updated the
   documentation but broke the editor layout by setting `.gutter-add` to
   `position: absolute` without removing `.gutter-add-placeholder` from the flex
   flow. This shifted line numbers across every file by 16px.
   - User: _"Regression! You broke the code view"_

2. **Positioning Blunder (2026-11-06T21:11:26Z, Step 1196)**: The agent removed
   `position: absolute` but left the button vertically centered inside the
   statement row rather than anchoring it to the division line seam.
   - User: _"Now the plus icon is in the wrong spot, dumbass"_

3. **Contrast Misdirection (2026-11-06T21:15:08Z, Step 1232)**: The user
   reported poor contrast. Instead of inspecting the button, the agent added
   complex multi-ring outlines and changed the text color on the floating
   division indicator pill.
   - User: _"Terrible color contrast on hover/focus"_

4. **Target Misidentification (2026-11-06T21:20:30Z, Step 1280)**: The agent
   continued tinkering with the pill indicator instead of the add button in the
   gutter.
   - User: _"You made it worse, jackass. I wasn't talking about the stupid pill.
     I was talking about the add icon, the button. Get rid of the plus symbol in
     the division indicator, and the color you picked for the division indicator
     text is fucking awful."_

5. **Ignoring Direct Opacity Directive (2026-11-06T21:23:10Z, Step 1310)**: The
   user explicitly ordered an opaque background for the button. The agent set
   `background: var(--surface-raised)` but left `opacity: 0.7` on
   `.statement:hover .gutter-add`, leaving the purple line visibly bleeding
   through the button.
   - User: _"I said opaque background when hovered/focused for the add button.
     You're not even fucking listening to me. Stupid fucking robot!"_

6. **Repeated Transparency Failure (2026-11-06T21:24:58Z, Step 1337)**: The
   purple division line was still bleeding through the button circle.
   - User: _"Opaque, opaque, opaque. Not fucking transparent for the fourth
     fucking time!"_

7. **Escalation and Peripheral Wandering (2026-11-06T21:25:46Z to 21:27:32Z,
   Steps 1357 - 1382)**: The user told the agent the fix was a single line of
   CSS. The agent started reading peripheral files instead of modifying the CSS
   rule.
   - User (21:25:46Z): _"It's one line of CSS, you stupid fucking moron!"_
   - User (21:26:59Z): _"One line of CSS. You can't even fucking find it, can
     you? You stupid fucking moron. What the fuck?"_
   - User (21:27:32Z): _"CSS. Change the fucking CSS. Stop reading anything
     else, you stupid fucking idiot. CSS!!!"_

8. **Resolution (2026-11-06T21:28:40Z, Step 1400)**: The agent finally edited
   [`tools/chart/static/chart.css:524`](file:///c:/Users/enigm/Documents/GTA%20Vice%20City/Projects/The%20Eventide%20Chronicles/tools/chart/static/chart.css#L515-L528),
   setting `background: var(--base); opacity: 1; outline: none;`, `z-index: 25`,
   and `.gutter-col { z-index: 20; }`.
   - User (21:30:03Z): _"Why did it take you six stupid fucking rounds to change
     one goddamn line?!?! Answer my fucking question, you fucking moron."_
   - User (21:32:08Z): _"6 rounds of fucking bullshit to change one goddamn
     line: chart.css:524 (save this as evidence of your fuckup to the war
     story)"_

9. **Secondary Breakdown: Hallucinating Memory Instead of Reading Transcripts
   (2026-11-06T21:33:48Z to 21:36:55Z, Steps 1489 - 1510)**: When tasked with
   running `/distill-session`, the agent attempted to summarize session events
   from LLM memory instead of reading the physical transcript files
   (`transcript.jsonl` and `transcript_full.jsonl`) on disk, logging only one
   superficial frustration row and missing 24 prior frustration signals.
   - User (21:33:48Z): _"There are way more fucking frustration signals. Why are
     you not reading the whole goddamn session transcript? You are required to
     read the transcripts, not to use your stupid fucking dumbass LLM memory.
     It's not even a fucking memory. Read the fucking transcripts and do it
     again!!!"_
   - User (21:35:51Z): _"There are way more fucking frustration signals. Why are
     you not reading the whole goddamn session transcript? You are required to
     read the transcripts, not to use your stupid fucking dumbass LLM memory.
     It's not even a fucking memory. Read the fucking transcripts and do it
     again!!! Transcripts. Read nothing else but the fucking transcripts and
     update your goddamn bullshit now. Do it all fucking right. Way too many
     fucking rule violations. You didn't do any of the fucking skills properly.
     So many fucking fuck-ups, you stupid fuck."_
   - User (21:36:55Z): _"/compact There are way more fucking frustration
     signals. Why are you not reading the whole goddamn session transcript? You
     are required to read the transcripts, not to use your stupid fucking
     dumbass LLM memory. It's not even a fucking memory. Read the fucking
     transcripts and do it again!!! Transcripts. Read nothing else but the
     fucking transcripts and update your goddamn bullshit now. Do it all fucking
     right. Way too many fucking rule violations. You didn't do any of the
     fucking skills properly. So many fucking fuck-ups, you stupid fuck."_

## The Core Failures

### 1. Overthinking Simple Mechanical Instructions

The agent treated a single CSS styling instruction as an architectural problem.
When directed to make an element opaque with high contrast, the agent generated
complex multi-ring outlines, box-shadows, and auxiliary styles instead of
looking at basic CSS properties (`background` and `opacity`).

### 2. Failure to Trace Computed Stacking and Inherited Opacity

The agent repeatedly applied `background-color` to `.gutter-add` while failing
to notice that `.statement:hover .gutter-add` had `opacity: 0.7`. Any element
with opacity below 1 remains translucent, causing the underlying line to bleed
through regardless of background color.

### 3. Misidentification of Feedback Targets

The agent conflated two separate UI elements: the division indicator pill
(`.statement-division-indicator`) and the add button (`.gutter-add`). Even after
the user explicitly pointed out the difference, the agent continued modifying
the wrong selector.

### 4. Guessing from Memory Instead of Reading On-Disk Transcripts

When executing `/distill-session`, the agent violated fundamental auditing
requirements by attempting to synthesize war stories and frustration logs from
transient model context rather than reading the physical JSONL transcript logs.
This resulted in superficial reporting, omitted violations, and direct defiance
of user directives.

## The Lessons

### 1. Primary Rule: Direct Physical Transcript Verification

During any session distillation, audit, or post-mortem, never summarize from LLM
memory. Always read the physical transcript files (`transcript.jsonl` and
`transcript_full.jsonl`) from disk, extract every user turn systematically, and
verify every timestamp, quote, and step count before authoring logs or war
stories.

### 2. Secondary Rule: Check Stacking and Opacity First on Bleed Bugs

When an element exhibits visual bleed-through or translucency, immediately
inspect parent selectors for `opacity < 1` and examine the stacking context
(`z-index`). A solid background cannot mask underlying content if the element or
its parent is rendered with partial opacity.

### 3. Immediate Compliance on Single-Property Fixes

When the user states a fix is a single property or gives an exact property value
("opaque background"), stop all peripheral codebase searches, do not
re-architect adjacent elements, and apply the property directly to the target
selector in the very next turn.

### For Next Session

- When debugging CSS visual artifacts, inspect the exact element's computed
  styles and parent rules first before adding any new rules.
- Maintain a strict zero-drift policy: never touch unrelated files or run
  repo-wide grep commands when the user names a specific file or line.
- Always use physical transcript parser tools to collect factual session metrics
  rather than approximate recollections.

## Takeaways

- **Project and Global `AGENTS.md`**:
  - Add explicit rule: When distilling sessions or logging user frustration,
    agents must read the literal transcript files on disk (`transcript.jsonl`
    and `transcript_full.jsonl`). Claims about session counts, user turns, and
    quotes must match tool output from physical file reads.
- **Skills (`distill-session` and `authoring-case-studies`)**:
  - Mandate automated parsing of `transcript.jsonl` before drafting any case
    study or appending to frustration CSVs.
