import type { GroupWatchParty } from "../types";

// Matches groupController.js's own DEFAULT_WATCH_PARTY_DURATION — a party
// created before durationMinutes existed has no value to read, not a 0.
const DEFAULT_DURATION_MINUTES = 240;

export function isWatchPartyLive(party: GroupWatchParty): boolean {
  const durationMs = (party.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60 * 1000;
  return Date.now() - new Date(party.scheduledAt).getTime() < durationMs;
}
