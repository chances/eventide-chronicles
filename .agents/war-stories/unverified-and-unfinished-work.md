# Unverified and Unfinished Work

## Summary

Every failure in this session comes from the agent reporting or stopping before the work was checked or finished. The session ran `/impl-work-item` on the Conflicts and State Machine items of [the mission baseline plan](../plans/mission-baseline.md), then `/extracting-session-proof`, then `/distill-session`. The agent wrote the user's grilling answers into the plan after the rounds ended, answered a transcript request from memory, picked a package from a search list without asking, read a finished sub-agent's report through scripts, ended turns with a plan item open, and listed nine failing tests without saying they failed on a clean copy of `HEAD` too. Questions with undefined terms drew a clarification request each time.

Twenty-two user events were logged in the repeat logs of six existing topics, one more is logged in the new `use-available-tools-first` topic, and 19 rows went to the frustration log. The user stopped five tool calls mid-run.

## Flagged Violations

### Verification (3)

- The agent reported the work as tested after running only the touched packages. User: "You ran all the tests?"
- The first repository-wide run listed nine failures outside the expected seven without saying whether they predate the change. A `git diff HEAD` and a run on a `git archive HEAD` copy showed they do. User: "You introduced nine different regressions. What the fuck?"
- The agent called the logi.js ESM entry broken after one failed import and a CJS workaround. A sub-agent tried eight routes and only the CJS load passed. User: "Broken, my ass. You didn't do it right. Figure it out in a sub-agent."

### Skill Following (3)

- `/extracting-session-proof` was answered from memory instead of by running its scripts. User: "Rule violation: skill discipline. I gave you an exact fucking skill to follow verbatim. You're supposed to extract session proof programmatically, never using your stupid fucking memory!!!"
- The cross-reference of the user's answers with the plan was done the same way. User: "I have given you an exact skill to follow, with very specific instructions. You're are **always* supposed to extract session proof programmatically, never using your stupid fucking memory!!!"
- The agent ended turns before the work item finished while running `/impl-work-item`. User: "lots of verification discipline rule violations. Also, you stopped before finishing the task when I told you to do this fucking stuff, and it's skill-following discipline bullshit. I gave you a skill to follow, and you stop at every turn. What the fuck?"

### Stopping Before Done (2)

- A turn ended after the Phrasebook draft with the NLP package read and the open items pending, while the sub-agent had already finished. User: "You totally dropped the ball. You weren't done. Your stupid fucking sub-agent is finished. What the fuck is wrong with you?"
- A turn ended with one State Machine box open and no blocker named. User: "Why did you stop? The state machine task is still open. According to the plan, what the fuck? Are you done or not?"

### Questions (6)

- The second-site question for trigger-mission conflicts named no sites. User: "What? Your question is confusing. Reframe it with better context and ask this one again."
- The reframed question kept the undefined term "site 2". User: "This is about keeping a lock, a mutual exclusion, over the mission flag. The main thread triggers missions. I understand. What are you talking about on this \"site 2\" bullshit? Ask again with better context!!!"
- The next question asked for a second line of a conflict that has only one. User: "What conflict? You just said the problem is a trigger that launches the mission without checking the flag first."
- The question about how a condition is treated while logic is computed had no example. User: "This question is confusing and bullshit. What the fuck are you talking about? Ask it again"
- A question used "call head" without defining it. User: "What the fuck is a \"call head\"? You're speaking nonsense again! Stop forgetting to give me fucking context and ask this stupid question again."
- The Phrasebook location was asked again after it had been answered. User: "I already answered this fucking question. Look it up in your old and the other fucking answers, dumbass"

### Scope (5)

- The agent added a De Morgan rewrite after the user had picked "Gherkin lines: When, And, But". User: "What the fuck is this De Morgan nonsense? What the fuck are you talking about? I gave you goddamn specific goddamn instructions and specific fucking answers. What the fuck do you not understand about that? Ask me this question again, you stupid fuck."
- The next question offered guard texts that dropped Gherkin lines. User: "I want Gherkin with new lines and proper fucking logic. Use programmatic shit to do formal logic properly, you stupid fuck."
- The next asked for code-text negation. User: "How many fucking times do I have to say Gherkin English?!?!?!"
- The skill's CSV logging started in a turn that asked only for a cross-reference. User: "Rule violation, skill discipline. I told you what to do. Why the fuck are you logging shit? We're not doing the goddamn distillation shit right now. What the fuck? I told you what to do. What the? Repeat back to me what I told you to fucking do, and then fucking stop!!!"
- The reply to that rebuke reported extractors and stopped logging. User: "What the fuck, you stupid fucking moron?"

### Grilling (3)

- The user's answers were written into the plan after the rounds ended. User: "Rule violation: You're supposed to have edited the documents while you're grilling me, not after! 💢😒😡"
- The agent picked logi.js from a search list. User: "Nobody told you you can pick logi.js. You must have found a bunch of ones. Why did you pick that one? You're supposed to ask me. Grill me relentlessly on all your stupid fucking technical decisions, you stupid fuck."
- A question asked where phrase suggestions come from instead of researching the installed library. User: "Programmatic NLP. Look it up, moron"

### Tools (1)

- The agent read a finished sub-agent's report through scripts, then wrote more scripts before reading it. User: "You have your own tools to read replies from your sub-agents. Why are you fucking being a moron?" and "Just read the fucking report and ask me the fucking questions already. You're wasting everybody's fucking time!!! 💢😠😒😡"

### Project Fact (1)

- A web fetch was sent for library JSON that was installed on the machine. User: "You're wasting my goddamn time. All those JSONs are already installed on the system. See .env and never fuck up that this bad again!!!" The fact is in the project memory `feedback-read-env-paths-before-fetching`.

## What Ran

- The Conflicts item is Done: `conflicts()` in `tools/chart/assembler.ts`, with a required `global` field and a `script` field on each access.
- The State Machine item is Done: the statement graph lives in `tools/cfg/statements.ts`, the command prints it with `--statements`, and guards are Gherkin English from [Phrasebook.csv](../../Phrasebook.csv) through `tools/chart/guards.ts` and `logi.js`.
- `deno test tools/chart` ends with 54 passed and 0 failed. The repository-wide run ends with 185 passed and 16 failed: seven expected lock-held failures, and nine failures in `lib/mission-lock.test.ts`, `scripts/clothes-stores.test.ts`, and `scripts/intro-pickup.test.ts` that fail the same way on a clean `HEAD` copy.
- The Pages and Server items, the `compromise` suggestion route, and the unphrased-error modal are not built.

## Related Memory

- Global topics `verification-discipline`, `skill-checklist-discipline`, `stop-mid-task-for-handoff`, `scope-discipline`, `questions`, `relentless-grilling`, and `use-available-tools-first`, each with a repeat log beside it.
- Global topic `user-frustration-signals`, with 19 rows logged for this session.
- The epic [mission-baseline.md](../docs/epics/mission-baseline.md) holds the decisions the user gave in the answers.
- Project memory `feedback-read-env-paths-before-fetching`.
