import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { DailyGameState, DailyGameGuessResult, DailyGameLeaderboardEntry } from "../types";

export async function getTodayPuzzle(): Promise<DailyGameState> {
  const res = await API.get(API_ROUTES.DAILY_GAME.TODAY);
  return res.data;
}

// Read-only, no attempt lookup/creation — the Shares-feed teaser band
// (DailyGameCard.tsx) uses this instead of getTodayPuzzle() specifically so
// just glancing at it doesn't start today's real elapsed-time clock. Only
// the actual game screen's own getTodayPuzzle() call should do that.
export async function getPuzzleStreak(): Promise<{ puzzleStreak: number }> {
  const res = await API.get(API_ROUTES.DAILY_GAME.STREAK);
  return res.data;
}

export async function useHint(type: "blur" | "letter"): Promise<DailyGameState> {
  const res = await API.post(API_ROUTES.DAILY_GAME.HINT, { type });
  return res.data;
}

export async function submitGuess(guess: string): Promise<DailyGameGuessResult> {
  const res = await API.post(API_ROUTES.DAILY_GAME.GUESS, { guess });
  return res.data;
}

// Serves both the in-game "Today's Top Scores" list and the Shares-feed
// ticker (DailyGameCard.tsx) — same one call, already sorted by the server.
export async function getLeaderboard(): Promise<{ entries: DailyGameLeaderboardEntry[] }> {
  const res = await API.get(API_ROUTES.DAILY_GAME.LEADERBOARD);
  return res.data;
}
