import GroupWatchParty from "../models/GroupWatchParty.js";
import { sendRawPush } from "./push.js";
import { pushPhrase } from "../utils/pushCopy.js";
import { PUSH_CHANNELS } from "../utils/pushMessages.js";

// A watch party's own 3 scheduled reminders — 30 minutes out, 10 minutes
// out, and the moment it starts — direct ask: RSVP only ever means
// something BEFORE a party starts (toggleWatchPartyRsvp itself now
// rejects one after), and that's exactly what these key off of. Checked
// every minute (server.js's own cron), not a one-off timer per party —
// this process may restart, a one-off setTimeout wouldn't survive that.
//
// Push only, with no Notification document behind it at all (no feed row,
// no "sender" — a scheduled system event, not something a person did) —
// same reasoning pushTicketUpdate's own comment documents for support
// tickets, see services/push.js's sendRawPush.
const THIRTY_MIN_MS = 30 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

export async function checkWatchPartyReminders() {
  const now = Date.now();

  // remindersSent.started is the last of the 3 flags ever set, so once a
  // party has sent every reminder it owes, it stops matching this query
  // at all — the one query this runs every minute stays cheap regardless
  // of how many watch parties a community has had historically.
  const candidates = await GroupWatchParty.find({
    "remindersSent.started": false,
    scheduledAt: { $lte: new Date(now + THIRTY_MIN_MS) },
  })
    .select("group contentTitle scheduledAt rsvps remindersSent")
    .populate("group", "slug")
    .lean();

  for (const party of candidates) {
    const msUntilStart = party.scheduledAt.getTime() - now;

    // Most urgent first — if the process was down long enough to miss an
    // earlier milestone entirely, there's no point sending it late.
    const milestone =
      msUntilStart <= 0 && !party.remindersSent.started
        ? "started"
        : msUntilStart <= TEN_MIN_MS && !party.remindersSent.tenMin
        ? "tenMin"
        : msUntilStart <= THIRTY_MIN_MS && !party.remindersSent.thirtyMin
        ? "thirtyMin"
        : null;
    if (!milestone) continue;

    // Claims this milestone atomically before sending anything — guards
    // against two overlapping cron ticks (a slow previous run still
    // finishing) double-pushing the same reminder.
    const claim = await GroupWatchParty.updateOne(
      { _id: party._id, [`remindersSent.${milestone}`]: false },
      { $set: { [`remindersSent.${milestone}`]: true } }
    );
    if (claim.modifiedCount === 0) continue;

    const phraseKey = milestone === "started" ? "Starting now" : milestone === "tenMin" ? "Starts in 10 minutes" : "Starts in 30 minutes";
    const groupSlug = party.group?.slug;
    if (!groupSlug) continue;

    for (const rsvp of party.rsvps) {
      sendRawPush(rsvp.user, (locale) => ({
        title: party.contentTitle,
        body: pushPhrase(locale, phraseKey),
        data: { type: "watchparty_reminder", groupSlug, partyId: party._id.toString() },
        channelId: PUSH_CHANNELS.activity,
      }));
    }
  }
}
