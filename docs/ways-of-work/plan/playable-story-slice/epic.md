# Playable Story Slice

## Goal

### Problem

The Eventide Chronicles has a growing set of missions, free-roam systems, visual ideas, and cell-phone features, but it does not yet have a single player-facing finish line. Without a defined MVP, work can continue indefinitely across story content, side activities, art, radio, skins, and technical cleanup without producing a coherent release. The existing mission scripts contain enough material for a short experience, but their role in the first act, their ending, and their relationship to the cell phone need to be defined together.

This is a hobbyist fan project with no monetization objective. Its primary risk is unfinished scope, not insufficient commercial scale.

### Solution

Create a short, polished playable story slice for The Eventide Chronicles. The MVP follows Toni through five story missions:

`Intro -> Cop -> Hotel -> Work -> Cart`

The first act ends with a dedicated narrative punctuation beat called **The Call After The Hit**. After the assassination in `Cart`, a call from the boss drops mid-instruction. Toni finds his car still running and empty, then receives another call whose voice does not match the apparent caller. The scene ends without explaining the event or resolving the larger mystery.

The story slice also includes at least three optional free-roam side activities, including an armed-robbery crime spree, stealing credit cards from pedestrians, and one rooftop rampage. These activities are supporting content, not alternate campaign paths.

### Impact

The MVP should provide:

- A finishable first-act experience of less than two hours for a first-time player.
- A clear introduction to Toni, the setting, the tone, the cell phone, and the central mystery without revealing its answer.
- A memorable cliffhanger that gives the project a deliberate stopping point.
- A small, testable content target for contributors working on missions, dialogue, assets, audio, and scripts.
- A stable foundation for later acts without requiring the second act or the full campaign to be complete.

## User Personas

### First-Time Player

A player familiar with Grand Theft Auto: Vice City who wants to try a short fan-made story. This player needs clear objectives, reliable mission progression, understandable controls, and a coherent ending rather than a tour of unfinished prototypes.

### Returning Player

A player who replays the story slice to explore optional activities, notice foreshadowing, test alternate approaches, or revisit the act-ending phone sequence.

### Hobbyist Contributor

A person contributing scripts, dialogue, models, textures, audio, testing, or documentation. This contributor needs a bounded content target, stable terminology, documented dependencies, and a clear separation between MVP requirements and future ideas.

## High-Level User Journeys

### First Playthrough

1. The player installs the MVP using the documented Vice City and mod setup.
2. The player starts a new game and meets Toni through `Intro`.
3. The player completes `Cop`, learning the basic mission rhythm, police pressure, and the role of the cell phone.
4. The player completes `Hotel`, gaining access to the next area and the tools or context needed to continue.
5. The player completes `Work`, establishing Toni's relationship with her boss and her ordinary work obligations.
6. The player completes `Cart`, carrying out a dangerous job that escalates the first act.
7. The player experiences **The Call After The Hit**: the dropped call, the empty still-running car, and the strange voice on the follow-up call.
8. The player reaches a deliberate end card or equivalent stopping state that identifies this as the end of the MVP story slice without explaining the mystery.

### Optional Free-Roam Play

1. The player encounters or unlocks side activities through the free-roam world and the available phone or contact systems.
2. The player chooses whether to attempt an armed-robbery crime spree, steal credit cards from pedestrians, or start a rooftop rampage.
3. The player receives clear feedback about starting, succeeding, failing, and ending each activity.
4. The player can return to story progression without losing the main mission state.

### Replay And Discovery

1. The player replays the story missions or starts a fresh save.
2. The player notices changes in mood, dialogue, environmental details, or phone behavior that support the project's unreliable presentation without explaining it.
3. The player experiments with optional activities and revisits the act-ending sequence.

## Business Requirements

### Functional Requirements

- The MVP must deliver the story sequence `Intro`, `Cop`, `Hotel`, `Work`, and `Cart` in a reliable order.
- Each story mission must have a clear start condition, objective flow, success state, failure state, cleanup path, and transition to the next intended state.
- The story must remain completable in less than two hours for a first-time player, excluding optional free-roam experimentation.
- `Intro` must establish Toni and the initial setting without requiring the player to know the full Book 2 canon.
- `Intro` must direct Toni to destroy or dump a car carrying unexplained evidence, teaching the player the pickup and vehicle-health systems without explaining the car's history.
- `Cop` must establish police pressure and introduce or reinforce the cell phone as part of the player's world.
- `Cop` must make the witness call legible as the immediate reason for the encounter: the caller describes Toni, and the police recognize her from an older, incomplete file.
- `Hotel` must advance access to the next story area and provide the transition into Toni's work life.
- `Work` must establish Toni's relationship with her boss and show the contrast between mundane work and dangerous obligations.
- `Cart` must provide the first-act escalation through a dangerous assassination job.
- The MVP must include **The Call After The Hit** as a playable or directed sequence immediately following `Cart`.
- The act-ending sequence must include all of the following beats:
  - The boss's call begins and drops before its instruction is complete.
  - Toni reaches the expected meeting point.
  - The boss's car is present, still running, and empty.
  - There is no clear sign of a struggle.
  - The phone rings again.
  - The apparent call from a friend is delivered through a strange man's voice.
  - The sequence ends without explaining the disappearance, the voice, or the larger mystery.
- The MVP must include at least three optional side activities.
- The side-activity set must include an armed-robbery crime spree, a credit-card theft activity involving pedestrians, and one rooftop rampage, unless a later approved design replaces one of these with an equivalent activity.
- Each side activity must have a discoverable start, a readable objective, a success or failure result, and a safe return to free roam.
- Side activities must not be required to finish the five-mission story sequence.
- The cell phone must support every phone interaction required by the story slice, including the act-ending call sequence. Unfinished phone numbers and unrelated dialer content may remain out of scope.
- Mission failure, player death, arrest, restart, and retry must return the player to a valid playable state without a script crash, invalid instruction pointer, stranded mission flag, or unrecoverable world state.
- Story text and system text must follow the project's branding rules: US English, Oxford comma, title case headings in documentation, no em dashes, restrained grim tone, and no unexplained jokes in system text.
- Canonical story decisions must be checked against the lore ledger before implementation. Any new canon must be recorded in `docs/lore.csv` with the appropriate status.
- Restricted story facts must remain in `docs/spoilers.md` and must not be stated or hinted at in player-facing strings, release art, store listings, or this PRD.
- The release must include a human-readable installation path and the project's required disclaimer, credits, and GPL-3.0 license.

### Non-Functional Requirements

- **Stability:** A complete first playthrough must not require console commands, manual script restarts, or developer-only recovery steps.
- **Compatibility:** The MVP must target the repository's supported Vice City executable, CLEO environment, plugin build, and installation workflow.
- **Performance:** Mission and side-activity scripts must maintain playable frame pacing on the project's supported hardware target, with no avoidable per-frame allocation or unbounded entity creation.
- **Recoverability:** Every mission and side activity must clean up entities, blips, pickups, timers, flags, wanted-level changes, road blockers, and phone state on success, failure, death, arrest, and retry.
- **Usability:** Objectives, destinations, interaction requirements, and failure conditions must be understandable without reading repository documentation.
- **Accessibility:** Important information must not depend on color alone. Essential objectives must be available through text, audio, or both, and timed sections must provide enough time for ordinary play.
- **Narrative restraint:** The MVP may introduce unexplained anomalies and uncertainty, but it must not provide a premature explanation of the central mystery.
- **Contributor clarity:** Each MVP story mission and side activity must have an owner-facing source file, a short design description, and a human test case before release.
- **Legal and provenance:** The release must preserve the project's fan-project disclaimer, credits, license, and any required third-party asset notices.

## Success Metrics

Because this is a hobbyist project, success is measured primarily through completion quality and player experience rather than monetization or audience growth.

- **Story completion:** A fresh installation can complete all five story missions and reach **The Call After The Hit** in a manual playthrough.
- **Time to complete:** A first-time tester completes the story slice in less than two hours, excluding optional activities and repeated attempts.
- **Critical stability:** No known blocker prevents a fresh player from starting, progressing, failing, retrying, or finishing the story slice.
- **Side-activity coverage:** At least three optional activities can be started, completed or failed, and exited without corrupting the story state.
- **Narrative comprehension:** Testers can identify Toni, her immediate situation, her relationship with her boss, the role of the phone, and the fact that the ending is an intentional cliffhanger.
- **Mystery preservation:** Testers do not receive a direct explanation of the central mystery from MVP text, objectives, art, or the act-ending sequence.
- **Contributor readiness:** A new contributor can locate the source for each MVP mission, identify its dependencies, and understand how to test its success and failure paths from the repository documentation.
- **Release reproducibility:** The documented build and installation workflow produces the same playable MVP from a clean checkout and supported game installation.

## Out Of Scope

- The boss's second-act death or incapacitation as a resolved story event. The MVP may foreshadow later consequences through the cliffhanger, but it does not answer them.
- Acts Two and Three, including the final explanation of the central mystery.
- Completing the full mission list, including `BossDie`, `Endgame`, `Fairy`, `Hell`, and `Heaven`, unless one of those scripts is required only as a technical dependency and remains inaccessible as unfinished player content.
- A full campaign ending or a complete conclusion to Toni's story.
- Additional mission branches, relationship systems, reputation systems, or multiple endings.
- A complete phone directory. Oakdale Rental, the Zit Hotline, mission dialing, ringtone assignment, and radio-track lookup remain separate decisions unless required by the five-mission slice.
- A complete radio replacement or music expansion.
- Full character mesh remodeling, final skin replacement, complete clothing-store expansion, and all planned visual-identity assets.
- A custom title mark, full billboard and vehicle-livery pass, or complete mood-specific `timecyc` system.
- A complete economy overhaul, including all credit-card behavior, ATM behavior, and payphone behavior beyond what the MVP side activity requires.
- Multiplayer, online services, monetization, analytics infrastructure, achievements, leaderboards, or live operations.
- Support for game versions, CLEO versions, operating systems, or hardware outside the repository's documented target.
- Treating material from the Eventide-III repository as canon.

## Business Value

**High for the project, non-commercial.**

The MVP has no expected direct revenue. Its value is that it converts a broad, unfinished hobby project into a playable artifact with a clear boundary. A short story slice can validate the project's tone, mission workflow, cell-phone presentation, and contributor process before significant effort is spent on later acts, large asset passes, or additional systems. The deliberate cliffhanger preserves room for future development without making the first release feel accidental or incomplete.

## MVP Release Boundary

The MVP is complete when a player can install the supported build, play `Intro`, `Cop`, `Hotel`, `Work`, and `Cart`, experience **The Call After The Hit**, try at least three optional side activities, and return to a stable free-roam or end-of-slice state. The release must stand on its own as a first-act experience and must not require Acts Two and Three to be implemented.

## Canon And Documentation Dependencies

- `docs/branding.md` defines voice, terminology, legal notices, and presentation rules.
- `docs/lore.md` and `docs/lore.csv` define canon status and departures from Book 2.
- `docs/spoilers.md` contains restricted story information and must not be copied into player-facing material.
- `docs/TODO.md` lists open decisions and unfinished work that may be promoted into the MVP only through this epic's scope.
- `docs/publish.md` defines publishing targets and release requirements.
- `plugins/cell-phone/README.md` defines the cell-phone plugin's current design and constraints.
