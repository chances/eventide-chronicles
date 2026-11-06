# Asking Questions Properly

## Summary

Every failure in this session traces to how the agent asked the user questions. The session ran `/impl-work-item` on the Launch Sites and Behavior items of [the mission baseline plan](../plans/mission-baseline.md), whose second step is to grill the open branches with AskUserQuestion. One question, where the measured counts at trace bound 24 are recorded, was rephrased six times without defining its terms or explaining them after the user asked for clarification. The agent then started a measurement run and edited the plan's Decisions table, neither of which the user had asked for, and the user deleted the added rows. No test, source file, or checklist box changed.

Fourteen user events were logged: seven on questions, three on writing docs, one on scope, one on attribution, and two general. The user stopped two tool calls mid-run.

## Flagged Violations

### Questions (7)

- The agent asked where the bound-24 counts are saved in the chart JSON without saying what the counts were. User: "I don't understand this question. Give me better context and ask again."
- The second phrasing added an invented schema field and defined nothing. User: "You made it worse. What are we measuring? The trace bound is the 24 ceiling, right? What the fuck are you talking about?"
- The third phrasing used the undefined labels "trace count" and "instruction count". User: "The count of what? Is the trace the depth of the tree? The instruction count makes sense, but you're being really way too fucking vague again. What the fuck are you talking about?"
- The fourth phrasing added a table of Intro numbers and kept a one-sentence question. User: "You didn't answer my fucking question. You need to clearly fucking explain what the fuck you're talking about. What the fuck are you asking? One fucking sentence is not enough, goddamn fucking. What the fuck? It's not God. Give me fucking clarification!!!!"
- The fifth phrasing defined trace count and instruction count but not trace, trace bound, or the `traces` field. User: "I don't fucking know. You're not answering my fucking question. What's the difference between trace counts, traces, trace bounds, etc.?"
- The sixth phrasing asked whether to store a count that a program can derive from the chart. User: "The charts already list all the instructions. Why the fuck do we need to store a count when we can count them programmatically, you dumb fuck? What the fuck are you talking about?"
- The agent took that reply as a go-ahead and started a five-mission measurement run instead of answering. User: "That's not what I fucking said. I asked you fucking questions!!!"

### Scope (1)

- The agent read "start over" as permission to edit the plan's Decisions table, and the edit left a placeholder row. User: "I did not say 'start over and implement the goddamn shit.' I said 'start over and grill me again,' you stupid fucking moron."

### Attribution (1)

- The handoff listed "Where trial counts are stored" under answers the user gave, as a rejection of JSON counts. The user had given no answer. User: "I deleted your stupid shit. Rule violation: honesty and attribution: er 'Where trial counts are stored' you totally mischaracterized what the fuck I was saying. I never gave you a goddamn answer."

### Writing Docs (3)

- The handoff held the open questions as one bullet inside its State section. User: "Amend your dumbass handoff. Open questions go in their own goddamn sections of fucking documents"
- The handoff was first written to the `.agents` folder root. User: "Handoffs go in the handoffs folder, dumbass."
- The file was then named `handoff-launch-sites-and-behavior.md` inside the handoffs folder. User: "Redundant fucking filename, you fucking dumbass."

### General (2)

- User: "You're totally fucking up. Start over, you stupid fuck."
- User: "Follow the skill verbatim! cascade failures, tons of rule violations, total inability to clarify after I've asked you to clarify a goddamn question five fucking times. New local war story!"

## What Ran

- The Intro mission, run through the capped runner at 1500 MB, gave 250 instructions and 1 trace at bound 12, and 250 instructions and 4 traces at bound 24. Missions 2 to 6 were not run.
- The handoff for a fresh session is [launch-sites-and-behavior.md](../handoffs/launch-sites-and-behavior.md).
- Three answers stand: guard lines are the enclosing `if` or `while` headers plus the earlier `if ... goto_if_false` lines in the same label block, traces cover the lock free and held, and a run that exceeds the cap at bound 24 stops and asks.

## Related Memory

- Global topic `questions` (merged from `answer-every-question-with-click-paths`, `ask-unless-next-step-is-same`, `ambiguous-layout-requests-ask-first`, `relentless-grilling`, `show-visual-choices-as-specimens`, and `quiz-options-no-clues`), with its repeat log beside it.
- Global topics `writing-docs`, `scope-discipline`, `attribution-and-honesty`, and `user-frustration-signals`, each with a repeat log.
