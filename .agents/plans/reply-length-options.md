# Reply Length Options

The goal is a reply that never reads as a wall of text. The Stop hook alone does not reach it, because it runs after the reply is on screen. This page explains each lever in plain words and recommends a combination.

## What Pushes Replies Long

| Cause | Where it lives | Evidence |
|---|---|---|
| The `Wait What` output style tells the agent to give every decision, number, threshold, and risk "in many short sentences, not fewer facts" | `~/.claude/output-styles/wait-what.md`, part of the standing instructions | It conflicts with the 3-block limit in every reply |
| The app asks for a closing message that is "your answer in full" after the summary box | The `wrap_up` tool text from the desktop app | A second full report follows the box |
| The 3-block limit is a reminder, written as a list of "don'ts" | `~/.claude/hooks/wall-of-text-reminder.ts` | 30 rows in `wall-of-text.csv` since 2026-09-10 |
| Nothing acts before the reply is shown | Hook design | The Stop hook runs after the text is on screen |

## The Levers

| Lever | When it acts | What it can do | Weakness |
|---|---|---|---|
| Output style | Before every reply, as standing instructions | Gives every reply a fixed shape | A rule that conflicts with it wins instead |
| Reminder hook | Before the agent starts writing | Adds text the agent reads | The agent can ignore it |
| Stop hook | After the reply is shown | Blocks it and forces a rewrite | The wall is seen once, and a rewrite costs a turn |
| MessageDisplay hook | While the reply is drawn | Replaces the text on screen with a shorter version | Hides text, and the agent still wrote the wall |
| Summary box (`wrap_up`) | At the end of a task | Shows a 300-character recap in a box | The closing message after it is the wall |
| Artifact or file | While writing | Moves long content out of chat | Needs a pointer line in chat |

## Options

1. **Fix the standing instructions (recommended).** Replace the prohibitions with a fixed reply shape, written as what a reply is: one bold outcome line, then at most one table or one list of five rows, then an optional one-line pointer. Remove the clauses in `Wait What` that ask for every fact. A shape leaves less to argue with than a list of "don'ts".
2. **Put reports in the summary box (recommended).** The end-of-task report goes into the `wrap_up` recap, and the closing message is one line or empty.
3. **Cut extra text from view.** A `MessageDisplay` hook shows the first 3 blocks and a note. The full text stays in the transcript. This hides content, so it needs your go-ahead.
4. **Keep the Stop hook.** It stays as the backstop. It is already wired and tested.

## Decision

Options 1, 3, and 4 are built, and the summary box (option 2) is not. Replies also use pictures first: a table, a `show_widget` diagram, or an artifact. The files are `~/.claude/output-styles/short-visual.md`, `wall-of-text-display.ts`, `wall-of-text-enforcer.ts`, and `reply-limits.ts` in `~/.claude/hooks`.
