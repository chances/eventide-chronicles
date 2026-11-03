// The lock vocabulary of this project, shared by the flow tests.
import type { LockConfig } from "./program.ts";

/** Before Task 4: the mission flag is `$ONMISSION`, and a trigger tests it. */
export const baselineLock: LockConfig = {
  lockVars: ["$ONMISSION"],
  grantedVars: [],
  neverTrue: ["DebugTrace"],
  acquireLabel: "AcquireMissionLock",
};

/** After Task 4: the mission flag is `$MissionLocked`, and `$MissionLockGranted` reports an acquire. */
export const candidateLock: LockConfig = {
  lockVars: ["$MissionLocked"],
  grantedVars: ["$MissionLockGranted"],
  neverTrue: ["DebugTrace"],
  acquireLabel: "AcquireMissionLock",
};

/** The seven mission triggers, in chain order. */
export const triggers = [
  "Star",
  "Police",
  "HOT",
  "Boss",
  "Golf",
  "Kill",
  "End",
];

/**
 * Effects that start a mission or prepare for it. A trigger that finds the lock held must do none of them;
 * it may still wait, name itself, or restart itself.
 */
export const commitPrefixes = [
  "Mission.LoadAndLaunchInternal",
  "Player.SetControl",
  "Camera.DoFade",
  "Text.PrintBigString",
  "Sphere.Remove",
];

export const isCommit = (effect: string): boolean =>
  commitPrefixes.some((p) => effect.startsWith(p));

/** Visible effects per run; a launch needs at most nine. */
export const bound = 12;
