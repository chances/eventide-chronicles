# Car Tutorial Bugs

Bug records are tabulated in [tutorial-car-fingerprint-prompt.csv](tutorial-car-fingerprint-prompt.csv). This document records the symptoms, expected behavior, and known scope.

## Fingerprint Prompt

In the first tutorial mission, a player prompt or dialog claims that the player's fingerprints are all over the car, even when the player has never touched it.

The prompt or dialog should not make this claim unless the player has touched the car.

The source of the prompt or dialog and the condition that triggers it have not been identified.

## Baseball Bat Pickup Loop

The tutorial prompts the player to pick up a baseball bat. If the player has already picked it up and then loses it after being busted or wasted, the bat is gone and cannot be picked up again. The script loops indefinitely on the pickup prompt and timer.

The player should be able to continue the tutorial after losing the bat. The pickup prompt and timer should not loop indefinitely when the bat is unavailable.

The script location and the pickup check that causes the loop have not been identified.
