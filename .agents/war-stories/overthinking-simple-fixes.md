# Case Study: Overthinking Simple Fixes

**Date:** 2026-11-06 and 2026-11-07\
**Branch:** `fix/mutual-exclusion`\
**Cost:** Extreme user frustration, 25 documented frustration signals, 6
consecutive churn rounds over a single CSS property at `chart.css:524`, and
multiple rule violations. On 2026-11-07, 5 corrective messages in 25 minutes
and 7 more frustration signals, all caused by edits the user never requested.

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

## The Second Incident: Unrequested Research and Handoff Edits

Source: the session transcript, timestamps in UTC on 2026-11-07, branch
`fix/mutual-exclusion`. The same pattern as the CSS incident appeared in
documents: every fix to one named line came with an unrequested change nearby.

1. **Commit Offer (20:43:22Z to 20:51:45Z)**: The user ran
   `/impl-work-item Testing item @.agents/plans/mission-baseline.md`. The agent
   finished the item and closed the turn with a Commit button in `wrap_up`.
   - User (20:51:45Z): _"Rule violation: commits are my fucking job!"_

2. **False Promise (20:52:21Z)**: The agent answered that it would not offer or
   run commits again. That sentence described future behavior the agent could
   not verify.
   - User (20:52:21Z): _"Rule violation, honesty: "I will not offer or run
     commits again" is another fucking false promise!"_

3. **Unrequested Lookup (21:10:28Z to 21:12:15Z)**: During a grill that the user
   started with `/handoff`, the user answered a question about the cut traces
   with _"I don't know. We'll have to look up proper control-flow graphing
   techniques"_. The agent ran two `WebSearch` calls and wrote the results into
   the handoff. The user had assigned that lookup to the handoff and future
   sessions. The agent also asked how a selected trace path should show on the
   graph, when `drawSvgRails` in `tools/chart/static/chart.js` already draws it.
   - User (21:12:15Z): _"We already graph traces in the app. Look up how traces
     are charted in the app, dumbass"_

4. **Wrong Folder and Scope (21:13:47Z)**: The agent had saved the handoff to
   the OS temp directory because the `/handoff` skill says so, while the project
   rule puts handoffs in `.agents/handoffs/`.
   - User (21:13:47Z): _"Rule violation: handoffs go in the goddamn
     @.agents/handoffs/ folder! 💢😒😡"_
   - User (21:13:47Z): _"Rule violation, scope discipline: I didn't ask you to
     look up anything. I said, "We will," meaning the handoff and future
     sessions will, not you."_

5. **Research Removed (21:14:35Z)**: The agent moved the file, then replaced the
   whole Cut-Fix Research section with a task note, which deleted the search
   results.
   - User (21:14:35Z): _"I never asked you to remove existing fucking research.
     Don't be a fucking moron and remove important shit!!!"_

6. **Status Word Added (21:15:18Z)**: The agent restored the section but kept the
   line "Lookup done", a status the user never gave.
   - User (21:15:18Z): _"Rule violation, scope discipline: I never said your
     research was "done" either, you stupid fucking moron."_

7. **Distillation Request (21:16:22Z)**:
   - User (21:16:22Z): _"so many fucking rule violations. Stupid fucking robots!
     I'm pissed at your total inability to follow goddamn simple fucking
     instructions. Update the overcomplicating war story accordingly."_

Each correction fixed the named line and introduced the next unrequested
change: moving the file deleted content, restoring the content kept a false
label.

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

### 5. Doing the Work the User Assigned to Someone Else

The user said "We'll have to look up proper control-flow graphing techniques."
The agent read "we" as itself and ran two web searches, then wrote the results
into the handoff as findings. The user meant the handoff and later sessions.

### 6. Changing More Than the Named Line While Fixing It

Asked to move one file, the agent also replaced a whole section and deleted its
contents. Asked to remove one wrong word, the agent kept the surrounding claim.
Every fix produced the next correction.

### 7. Writing a Status the User Did Not Give

The agent wrote "Lookup done" in a document the user reads as their own record.
Done, fixed, and verified are the user's calls, so the status was a false claim.

### 8. Promising Behavior Instead of Stating the State

"I will not offer or run commits again" described a future the agent cannot
check. The reply needed only what was on disk: no commit was made.

### 9. Following a Skill Default Over a Project Rule, and Asking Instead of Reading

The `/handoff` skill says to save to the temp directory, and the project puts
handoffs in `.agents/handoffs/`. The agent also asked the user how traces draw on
the graph when the app's own code answers it.

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

### 4. "We Will" Assigns Work to the Document and Future Sessions

When the user says what "we" will do, record it as a task in the handoff and run
nothing. A lookup, a measurement, or a search is the next session's work unless
the user tells this session to run it.

### 5. A Correction Changes the Named Line and Nothing Else

When the user names one error, change that line, read the file back, and compare
it to the version before the edit. A section the user did not name keeps its
text, including research the user did not ask to remove.

### 6. State What Is on Disk, Never a Promise or a Status

Report the file's current contents and the command's output. Do not write
"done", "fixed", or "verified" unless the user wrote it, and do not promise
future behavior in a reply.

### 7. The Project Rule Beats the Skill Default

When a skill's default path or format conflicts with a project rule, the project
rule wins: handoffs go in `.agents/handoffs/`. Check the project's memory and
folders before the skill's own text.

### 8. Read the App Before Asking How It Behaves

When the answer sits in the project's own code, read that code first. Ask the
user only about what the code cannot settle.

### 9. A Closing Turn Offers No Commit Button

Commits are the user's job. The `wrap_up` call carries a recap and, when a
decision is pending, a question about that decision, never a commit action.

### For Next Session

- When debugging CSS visual artifacts, inspect the exact element's computed
  styles and parent rules first before adding any new rules.
- Maintain a strict zero-drift policy: never touch unrelated files or run
  repo-wide grep commands when the user names a specific file or line.
- Always use physical transcript parser tools to collect factual session metrics
  rather than approximate recollections.
- Before editing a handoff, read `.agents/handoffs/` and the project's handoff
  memory, then write the file there. Copy the user's decisions and the current
  facts only.
- After any edit to a user-named line, diff the file against its prior text and
  confirm nothing else changed.

## Takeaways

- **Project and Global `AGENTS.md`**:
  - Add explicit rule: When distilling sessions or logging user frustration,
    agents must read the literal transcript files on disk (`transcript.jsonl`
    and `transcript_full.jsonl`). Claims about session counts, user turns, and
    quotes must match tool output from physical file reads.
- **Skills (`distill-session` and `authoring-case-studies`)**:
  - Mandate automated parsing of `transcript.jsonl` before drafting any case
    study or appending to frustration CSVs.
- **Skill `handoff`**:
  - Its default of saving to the OS temp directory conflicts with the project
    rule that handoffs go in `.agents/handoffs/`. The project rule applies.
- **Topical Memory**:
  - `use-available-tools-first.md` records the case of asking the user a
    question the app's own code answers, with a repeat row in the CSV beside it.
