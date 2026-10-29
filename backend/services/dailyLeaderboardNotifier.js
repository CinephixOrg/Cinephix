import User from "../models/User.js";
import DailyPuzzle from "../models/DailyPuzzle.js";
import DailyPuzzleAttempt from "../models/DailyPuzzleAttempt.js";
import { todayDateKey } from "./dailyPuzzleService.js";
import { sendRawPush } from "./push.js";
import { pushPhrase } from "../utils/pushCopy.js";
import { PUSH_CHANNELS } from "../utils/pushMessages.js";

// Periodic "someone just took the lead" push — direct ask, on top of the
// already-shipped notifyDailyPuzzleReady. Only fires when today's real
// leader has actually changed since the last time this sent (tracked on
// DailyPuzzle.lastAnnouncedLeaderId) — a repeating cron that re-announced
// an unchanged leader every few hours would just read as spam. Never sent
// to the leader themselves (nothing to invite them to beat) or to anyone
// who's already solved today's puzzle (they can't take another crack at
// it until tomorrow, so "can you beat them?" wouldn't mean anything).
export async function notifyIfLeaderChanged() {
  const date = todayDateKey();
  const puzzle = await DailyPuzzle.findOne({ date });
  if (!puzzle) return;

  const topAttempt = await DailyPuzzleAttempt.findOne({ date, solved: true }).sort({ score: -1, solvedAt: 1 });
  if (!topAttempt) return; // nobody has solved it yet today
  if (puzzle.lastAnnouncedLeaderId && String(topAttempt.user) === String(puzzle.lastAnnouncedLeaderId)) return;

  const leader = await User.findById(topAttempt.user).select("username").lean();
  if (!leader) return;

  const alreadySolvedUserIds = await DailyPuzzleAttempt.find({ date, solved: true }).distinct("user");
  const recipients = await User.find({
    _id: { $nin: alreadySolvedUserIds },
    "pushTokens.0": { $exists: true },
  })
    .select("_id")
    .lean();

  for (const user of recipients) {
    sendRawPush(user._id, (locale) => ({
      title: "Cinephix",
      body: pushPhrase(locale, "{{username}} just took the lead on today's puzzle! Can you beat them?", { username: leader.username }),
      data: { type: "daily_puzzle_leader_changed" },
      channelId: PUSH_CHANNELS.activity,
    }));
  }

  puzzle.lastAnnouncedLeaderId = topAttempt.user;
  await puzzle.save();
}
