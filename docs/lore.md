# Lore

This document defines the story world of The Eventide Chronicles: how it relates to Book 2 of the Enbenite series, how its canon is decided, and where its story stands. Every decision is recorded in the ledger, [lore.csv](lore.csv). The ledger is the source of truth for status. This document explains the decisions in prose.

Voice, style, and legal notices live in [branding.md](branding.md).

Status: Draft. Items marked **Open** await decisions or the Book 2 text.

## Status Legend

Every ledger entry carries one status.

| Status | Meaning |
| --- | --- |
| Book | Defined by Book 2 and not contradicted by the mod. |
| Mod | Defined by the mod. Takes precedence over Book 2 in any conflict. |
| Open | Not yet decided. |

## Relationship to Book 2

The mod is an alternate universe branched from Book 2 of the Enbenite series, "Turning Darkness into Light" by Libby Shimmz. Book 2 is an unfinished manuscript published on Archive of Our Own, so the mod is working from a source that is still being written.

Two consequences follow from that.

- The mod can define material the book has not reached yet. Those parts are open ground.
- Decisions made in the mod may later flow back into the book. The author has indicated this possibility. Any upstreamed decision will change its ledger status to Book once it is adopted there.

## Canon Precedence

The mod's canon wins any conflict with Book 2. The mechanism works like this:

1. A contributor checks the ledger before writing a story element.
2. If Book 2 defines the element and the mod keeps it, the entry is Book.
3. If the mod changes or replaces it, the entry is Mod, and the change is recorded as a departure in the ledger with a note explaining what the book says and what the mod does instead.

A departure is never silent. If the mod contradicts the book without a ledger entry, the contradiction is a bug in the documentation.

## Open Ground

The parts of Book 2 that were never written are open ground. The mod defines them as its own canon, and each such decision is entered in the ledger as Mod, with a note that it fills a gap.

## Tone and Narration

The story is grim and serious. It is told through unreliable narrators, and the player is expected to notice where an account is false or self-serving. Each unreliable account must have a discoverable truth or a clear reason it misleads.

The story contains dark comedy. The comedy comes from events and characters whose plans collapse in ways the reader can see coming. The narration never announces a joke and never laughs at itself. Characters may laugh at happenstance. The line between comedy and tragedy stays thin, which is why the story's darkest moments can also read as absurd.

The writing rules for in-game narration and dialogue differ and are **Open**. They will be defined in [branding.md](branding.md) after the grilling is complete.

## World and Setting

The Enbenite series is named for an imaginary mineral. The mineral's name, properties, and role in the world are **Open**, pending the Book 2 text. Each one will be entered as Book if the book defines it, or as Mod if the mod defines it.

Setting, geography, and factions are also **Open**, pending the Book 2 text.

## Characters

Character entries are **Open**, pending the Book 2 text. Each character will be recorded in the ledger with a status and any departure from the book's portrayal.

## Mission Structure

The mod's scripts define eleven mission labels, including the initialization label. The ten story labels are Intro, Cop, Hotel, Work, Cart, BossDie, Endgame, Fairy, Hell, and Heaven. Each label is listed in the ledger with its script source. The labels are Mod, because the mod defines them. The story beat each one carries is **Open**, pending the Book 2 text and the mod's own plotting.

The labels suggest a late arc that moves from the mortal world into something supernatural, but that reading is not yet confirmed by any story text.

## Out of Scope

The Eventide-III repository on the upstream author's account is unrelated. It was an attempt to adapt the same story to Grand Theft Auto III and was abandoned in favor of this repository. Its material is not canon for this mod and does not appear in the ledger.

## Canon Ledger

The full ledger is [lore.csv](lore.csv). Its columns are:

- `id`: a stable identifier for the entry.
- `section`: the section of this document that discusses the entry.
- `topic`: the element being defined.
- `status`: Book, Mod, or Open.
- `source`: where the entry is defined, such as Book 2, a script file, or a decision.
- `departure_note`: for Mod entries that depart from Book 2, what the book says and what the mod does instead.
- `notes`: anything else a contributor needs to know.

## Terms and References

The following tropes are used in this document and are linked to their TV Tropes pages:

- [Unreliable Narrator](https://tvtropes.org/pmwiki/pmwiki.php/Main/UnreliableNarrator)
- [Black Comedy](https://tvtropes.org/pmwiki/pmwiki.php/Main/BlackComedy)
- [First Law of Tragicomedies](https://tvtropes.org/pmwiki/pmwiki.php/Main/FirstLawOfTragicomedies)
- [Alternate Universe](https://tvtropes.org/pmwiki/pmwiki.php/Main/AlternateUniverse)
- [Canon Discontinuity](https://tvtropes.org/pmwiki/pmwiki.php/Main/CanonDiscontinuity)
- [Canon](https://tvtropes.org/pmwiki/pmwiki.php/Main/Canon)
