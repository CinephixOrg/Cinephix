import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";
import User from "../models/User.js";
import DailyPuzzleAttempt from "../models/DailyPuzzleAttempt.js";
import { getOrCreateTodaysPuzzle, todayDateKey } from "../services/dailyPuzzleService.js";
import { bumpPuzzleStreak, computePuzzleStreakBadge } from "./badgeController.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

// Tunable constants kept in one place, per the plan — not hardcoded inline
// at each call site.
const MAX_BLUR_LEVEL = 4; // 4 = most blurred, 0 = fully clear
const MAX_LETTER_REVEAL_RATIO = 0.5; // letter-hints alone can never fully solve it
const SCORE_START = 100;
const BLUR_HINT_COST = 10;
const LETTER_HINT_COST = 15;
const WRONG_GUESS_COST = 5;
const SCORE_FLOOR_ON_SOLVE = 10;
// Bounded on purpose — direct ask ("skor formülüne... küçük, sınırlı bir
// zaman cezası"): time only ever breaks a tie between two equally-hinted
// solves, it can never outweigh the hint/guess costs above. 20 points max,
// losing 1 point every 15 seconds, floors out well before it could ever
// dominate a score that already started at 100.
const TIME_PENALTY_INTERVAL_SECONDS = 15;
const MAX_TIME_PENALTY = 20;
// Leaderboard surfaces (in-game list + the Shares-feed ticker) both read
// through this one constant.
const LEADERBOARD_SIZE = 10;

// Splits a title into per-word letter/digit-only strings (accented
// letters kept as single characters, every other punctuation dropped
// entirely) — e.g. "Guardians of the Galaxy Vol. 2" -> ["Guardians","of",
// "the","Galaxy","Vol","2"]. Shared by the box "shape" sent to the client
// and the flat answer string used for guess-matching/letter-reveal
// indexing, so the two can never drift out of sync with each other.
function titleWords(title) {
  return title
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0);
}

function flatAnswer(title) {
  return titleWords(title).join("");
}

async function hydrateContent(contentId, contentType) {
  const model = contentType === "movie" ? Movie : Series;
  const doc = await model.findById(contentId).select("title name poster_path").lean();
  if (!doc) return null;
  return { title: doc.title || doc.name || null, posterPath: doc.poster_path || null };
}

// Never sends the real title/answer letters — only the box "shape" (word
// groups + each box's length) plus whichever indices have already been
// hint-revealed. `locked` boxes (space/punctuation positions) don't exist
// in this shape at all, since titleWords() already stripped them — every
// box in the shape is a real letter/digit the player must fill or has had
// revealed.
function buildShape(title, revealedLetters) {
  const revealedByIndex = new Map(revealedLetters.map((r) => [r.index, r.letter]));
  let cursor = 0;
  return titleWords(title).map((word) => {
    const boxes = [];
    for (let i = 0; i < word.length; i++) {
      boxes.push({ index: cursor, letter: revealedByIndex.get(cursor) ?? null });
      cursor++;
    }
    return boxes;
  });
}

async function getAttemptAndTitle(userId) {
  const puzzle = await getOrCreateTodaysPuzzle();
  if (!puzzle) return { puzzle: null, attempt: null, content: null };

  const date = todayDateKey();
  let attempt = await DailyPuzzleAttempt.findOne({ user: userId, date });
  if (!attempt) {
    try {
      attempt = await DailyPuzzleAttempt.create({
        user: userId,
        date,
        contentId: puzzle.contentId,
        contentType: puzzle.contentType,
        blurLevel: MAX_BLUR_LEVEL,
        score: SCORE_START,
      });
    } catch (err) {
      // Unique-index race on the same user's near-simultaneous first
      // request of the day — the loser just reads what the winner wrote.
      if (err.code === 11000) attempt = await DailyPuzzleAttempt.findOne({ user: userId, date });
      else throw err;
    }
  }

  const content = await hydrateContent(puzzle.contentId, puzzle.contentType);
  return { puzzle, attempt, content };
}

// `posterPath` IS sent to the client — blurring happens client-side (this
// app's existing `blurRadius` house style, same as LeaderboardCard.tsx's
// tier-locked posters) scaled by `blurLevel`, not by withholding the real
// image URL. Only the title/letters stay server-side until hinted or
// solved.
function serializeState(attempt, content, puzzleStreak) {
  return {
    date: attempt.date,
    contentType: attempt.contentType,
    // The attempt's own creation time — doubles as "when this puzzle
    // started" for the client's own visible running timer (a plain local
    // setInterval against this real, server-authoritative instant, not a
    // guess). The actual time-based score penalty is still computed and
    // applied server-side, in submitGuess, regardless of what the client
    // displays.
    startedAt: attempt.createdAt,
    posterPath: content.posterPath,
    shape: buildShape(content.title, attempt.revealedLetters),
    blurLevel: attempt.blurLevel,
    maxBlurLevel: MAX_BLUR_LEVEL,
    hintsUsed: attempt.hintsUsed,
    maxLetterReveals: Math.floor(flatAnswer(content.title).length * MAX_LETTER_REVEAL_RATIO),
    revealedCount: attempt.revealedLetters.length,
    guessesCount: attempt.guessesCount,
    solved: attempt.solved,
    score: attempt.score,
    puzzleStreak,
  };
}

// @route GET /api/daily-game/today
export const getTodayPuzzle = asyncHandler(async (req, res) => {
  const { attempt, content } = await getAttemptAndTitle(req.user.id);
  if (!attempt) return sendError(res, "No puzzle available today", 503);

  const [streakBadge] = await computePuzzleStreakBadge(req.user.id);
  sendSuccess(res, serializeState(attempt, content, streakBadge.count), "Today's puzzle fetched");
});

// @route GET /api/daily-game/streak — direct report: the Shares-feed
// teaser band (DailyGameCard.tsx) only ever needed `puzzleStreak` to decide
// its own cross-fade text, but called this same `getTodayPuzzle` to get it
// — which, via getAttemptAndTitle, silently creates today's
// DailyPuzzleAttempt (and starts its real, server-authoritative
// `startedAt` clock) the instant the teaser band mounts, well before the
// player has actually opened the game. By the time they tapped in, the
// visible timer jumped straight to however long they'd already been
// scrolling Shares, reading as "doesn't start from 0." This endpoint reads
// only the streak (no attempt lookup/creation at all), so the real game
// screen's own GET /today call is the one and only moment that starts the
// clock.
export const getPuzzleStreak = asyncHandler(async (req, res) => {
  const [streakBadge] = await computePuzzleStreakBadge(req.user.id);
  sendSuccess(res, { puzzleStreak: streakBadge.count }, "Puzzle streak fetched");
});

// @route POST /api/daily-game/hint   body: { type: "blur" | "letter" }
export const useHint = asyncHandler(async (req, res) => {
  const { type } = req.body;
  if (!["blur", "letter"].includes(type)) return sendError(res, "Invalid hint type", 400);

  const { attempt, content } = await getAttemptAndTitle(req.user.id);
  if (!attempt) return sendError(res, "No puzzle available today", 503);
  if (attempt.solved) return sendError(res, "Already solved today's puzzle", 400);

  if (type === "blur") {
    if (attempt.blurLevel <= 0) return sendError(res, "Poster is already fully clear", 400);
    attempt.blurLevel -= 1;
    attempt.score = Math.max(0, attempt.score - BLUR_HINT_COST);
  } else {
    const answer = flatAnswer(content.title);
    const maxReveals = Math.floor(answer.length * MAX_LETTER_REVEAL_RATIO);
    if (attempt.revealedLetters.length >= maxReveals) {
      return sendError(res, "No more letter hints available today", 400);
    }
    const revealedIndices = new Set(attempt.revealedLetters.map((r) => r.index));
    const available = [...Array(answer.length).keys()].filter((i) => !revealedIndices.has(i));
    if (available.length === 0) return sendError(res, "No more letters to reveal", 400);
    const index = available[Math.floor(Math.random() * available.length)];
    attempt.revealedLetters.push({ index, letter: answer[index] });
    attempt.score = Math.max(0, attempt.score - LETTER_HINT_COST);
  }

  attempt.hintsUsed += 1;
  await attempt.save();

  const [streakBadge] = await computePuzzleStreakBadge(req.user.id);
  sendSuccess(res, serializeState(attempt, content, streakBadge.count), "Hint applied");
});

// @route POST /api/daily-game/guess   body: { guess: string }
export const submitGuess = asyncHandler(async (req, res) => {
  const { guess } = req.body;
  if (!guess || typeof guess !== "string") return sendError(res, "A guess is required", 400);

  const { attempt, content } = await getAttemptAndTitle(req.user.id);
  if (!attempt) return sendError(res, "No puzzle available today", 503);
  if (attempt.solved) return sendError(res, "Already solved today's puzzle", 400);

  const normalizedGuess = guess.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const correct = normalizedGuess === flatAnswer(content.title).toLowerCase();

  let newlyEarnedBadge = null;
  if (correct) {
    attempt.solved = true;
    attempt.solvedAt = new Date();
    const elapsedSeconds = (attempt.solvedAt.getTime() - attempt.createdAt.getTime()) / 1000;
    const timePenalty = Math.min(MAX_TIME_PENALTY, Math.floor(elapsedSeconds / TIME_PENALTY_INTERVAL_SECONDS));
    attempt.score = Math.max(SCORE_FLOOR_ON_SOLVE, attempt.score - timePenalty);
    await attempt.save();
    newlyEarnedBadge = await bumpPuzzleStreak(req.user.id);
  } else {
    attempt.guessesCount += 1;
    attempt.score = Math.max(0, attempt.score - WRONG_GUESS_COST);
    await attempt.save();
  }

  const [streakBadge] = await computePuzzleStreakBadge(req.user.id);
  sendSuccess(
    res,
    {
      ...serializeState(attempt, content, streakBadge.count),
      correct,
      // Only revealed once actually solved — never leaked on a wrong guess.
      title: attempt.solved ? content.title : undefined,
      newlyEarnedBadges: newlyEarnedBadge ? [newlyEarnedBadge] : [],
    },
    correct ? "Solved!" : "Incorrect guess"
  );
});

// @route GET /api/daily-game/leaderboard — today's top scorers, ranked
// score desc then faster solve wins a tie. Deliberately never exposes raw
// `solvedAt` timing to the client, only the already-sorted rank order —
// serves both mobile surfaces (the in-game list and the Shares-feed
// ticker), no second endpoint needed for either.
export const getLeaderboard = asyncHandler(async (req, res) => {
  const date = todayDateKey();
  const top = await DailyPuzzleAttempt.find({ date, solved: true })
    .sort({ score: -1, solvedAt: 1 })
    .limit(LEADERBOARD_SIZE)
    .select("user score")
    .lean();

  const users = await User.find({ _id: { $in: top.map((a) => a.user) } })
    .select("username profile_pic_url accountTier")
    .lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const entries = top
    .map((a) => {
      const u = userById.get(a.user.toString());
      if (!u) return null;
      return { user: { id: u._id.toString(), username: u.username, profile_pic_url: u.profile_pic_url, accountTier: u.accountTier }, score: a.score };
    })
    .filter(Boolean);

  sendSuccess(res, { entries }, "Today's leaderboard fetched");
});
