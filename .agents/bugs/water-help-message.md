# Water Help Message

This document records the symptom and expected behavior from the playtest report.

## Symptom

When the player is on foot and touches water, a help message is expected to explain that the player cannot swim, followed by a text box explaining that the player can teleport to land. The report says the help message is never shown when the player is in a car.

## Scope

- Water help and teleport handling occur in the `Swim` and `Water` scripts, at `main.txt` lines 2264 to 2282 (`:Swim`) and 7550 to 7617 (`:Water`).
