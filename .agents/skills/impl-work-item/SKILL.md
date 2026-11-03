---
name: impl-work-item
description: Use when implementing a plan work item (.agents/plans/*.md), grilling its open decisions, or ticking its .ac.md boxes.
---

# Implement Work Item

A work item is a row in a plan's Work Items table. Its acceptance boxes sit in the sibling `.ac.md`. Its scope and status sit in the epic's front matter and body under `.agents/docs/epics/`.

## Steps

1. **Ground.** Read the plan, the `.ac.md`, and the epic front matter and body in full. Done when every question you hold is answerable from those three or is a genuine open branch.
2. **Grill the frontier.** Ask every open branch with AskUserQuestion, one round per frontier, each option complete alone. Done when the frontier is empty and each answer sits in the plan's Decisions table, read back.
3. **Cite.** Fetch first, then reply: a library, language, or regex fact leaves your mouth only after a WebFetch, WebSearch, or Context7 call this turn, with the source named in the reply. A user's "no lookups" or "quick yes or no" sets the reply's length and leaves the fetch in place: fetch, then answer in one line with the source. Done when the tool call is in this turn's record and the reply names its source.
4. **Red, then green.** Write the test, run it red, implement, run it green. Done when the unpiped run shows the pass summary and the red run is on record.
5. **Cover, then tick.** A box is covered when a test or read-back exercises all of its wording. Done when each covered box is ticked and each uncovered box stays open with its missing case named beside it.
6. **CSV.** Edit through `jsr:@std/csv` `parse` and `stringify` inside `deno eval`. Done when the read-back matches the request.
7. **Refresh.** Give every plan or epic line your work made stale its new fact in the same turn. Done when the read-back shows it.
8. **Finish the item.** Work through the task list. A turn ends on a done item or a quoted blocker. Done when one of those two holds.
9. **Report.** Quote the command output and name the state. Fixed and verified are the user's calls. Done when the report holds output and declares nothing.

## Signals

- An answer the plan or epic holds: read it, then ask the open branch only.
- A "no lookups" request: fetch, then answer in one cited line.
- A regex slot: run it against the real library for overlap before shipping.
- A ticked box with a missing case: reopen it.
