import User from "../models/User.js";
import { sendRawPush } from "./push.js";
import { pushPhrase } from "../utils/pushCopy.js";
import { PUSH_CHANNELS } from "../utils/pushMessages.js";

// Fires shortly after dailyPuzzleService's own midnight pick, same
// end-to-end shape as checkWatchPartyReminders — a system push with no
// sender/no saved Notification row, via sendRawPush. Only users who've
// actually registered a push device get a (free, no-op) call —
// sendRawPush's own devicesOf lookup would just no-op per user anyway, but
// selecting pushTokens.0 first avoids paging through every user in the
// collection for nothing.
export async function notifyDailyPuzzleReady() {
  const users = await User.find({ "pushTokens.0": { $exists: true } })
    .select("_id")
    .lean();

  for (const user of users) {
    sendRawPush(user._id, (locale) => ({
      title: "Cinephix",
      body: pushPhrase(locale, "Today's puzzle is ready!"),
      data: { type: "daily_puzzle_ready" },
      channelId: PUSH_CHANNELS.activity,
    }));
  }
}
