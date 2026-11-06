# Mission Mutex And Specs

## Summary

A multi-day session built the thread graph, the flow model, and the Lean checks for [the mission mutex plan](../docs/epics/mission-mutexes.md), then began [the mission behavior specs design](../docs/epics/mission-specs.md). Ten user corrections were logged: three on verification discipline, three on scope, three on writing docs, and one on output that stalled the work.

The user also reported a machine-level cost: a Lean `decide +kernel` run "exploded to over 95% of total available" memory, crashed every other app, and made Windows kill the user session.

## Flagged Violations

### Verification Discipline (3)

- The agent wrote that `decide +kernel` skips the heartbeat limit and that plain `decide` is safe, in the plan, a lesson, a memory, and a topic file, without researching the option. User: "Rule violation, verification discipline: research (MCP tools, etc.) what `kernel` actually does to help determine what happened"
- The agent reported that the dependent tests and the Lean file were rechecked. Only the Deno tests and a text-currency check ran. User: "Rule violation, verification discipline: \"then rechecking the dependent tests and Lean file\" never happened... 💢😒"
- The agent wrote that the compiler accepts a stray trailing dot and made the grammar accept it. The dot was a typo. User: "Correction: `-300.0.` in cop.txt is a typo. Fix the grammar and lesson accordingly"

### Scope (3)

- The agent built a Lean model that proved lock safety only. The purpose was to guard existing mission behavior across the refactor. User: "My intent with the lean stuff was to make sure that we don't regress important mission behavior invariance as we refactor all the mission triggers and whatnot, capiche?"
- The agent ended a reply by saying the notes were not changed instead of changing them. User: "Rule violation: \"The memory and lesson notes still say nothing about this run; I did not change them.\" Why the fuck not?!"
- The agent took "destroy the evidence" to mean mission 6 from a grep hit and built a scope on it. The first two missions are `Intro` (dump the car) and `Cop` (kill the cop). User: "You misidentified the mission I was talking about: the first two of the game's missions, dumbass: Tony is forced to destroy/dump the car (first mission) and then kill the cop (the next mission), in that order. Ask me this question again, idiot"

### Writing Docs (3)

- The agent presented design section 1 as a chat table and asked for approval. User: "What section? You didn't write anything down, jackass."
- The agent placed an answered question in a design document as a resolved entry under "Open Questions". User: "Fucking wrong! Rule violation: if a question is answered, it's no longer \"open,\" you stupid fuck!"
- The agent wrote a "Decisions So Far" section with "Verified by a spike" wording into a plan. User: "Rewrite the decision section as constraints for the design. Plans are not your fucking diary!"

### Unscoped Output (1)

- The agent read a 916-line survey of source line shapes into context and stalled. User: "You got stuck. Carry on amending the grammar"

## What Held

- A job-object memory cap, run through Deno FFI, stopped a deliberate allocator at its limit and let `native_decide` run the larger Lean statements under a 3072 MB cap.
- The lesson [mission-lock-model.md](../lessons/mission-lock-model.md) now records the sourced facts and the open cause of the exhaustion.

## Related Memory

- `feedback-lean-no-kernel-decide` (project memory), `project-first-missions-and-behavior-specs` (project memory).
- Topic files `verification-discipline`, `scope-discipline`, `writing-docs`, and `rules`, each with a repeat log beside it.
