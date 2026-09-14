// Debug: gives one account a notification of every type the app supports,
// each backed by the real data it points at, so notification routing and
// rendering can be tested by hand. From backend/:
//
//   node scripts/seedNotifications.js <username or email>
//   node scripts/seedNotifications.js <username or email> --dry-run
//
// Other existing accounts act as the senders:
//
//   follow      A follows you                          tap -> A's profile
//   message     B sends you a DM (a real conversation)  the card shows the message; tap -> the chat with B
//   share_like  C likes one of your shares              "C liked your share"; tap -> that share
//   share_like  ten people like another of your shares  "10 users liked your share"; tap -> that share
//
// These are real changes, not mock rows: afterwards A follows you, the DM is
// in your inbox and the likes are on your shares — exactly as if those people
// had acted. If you have fewer than two shares, test recommendation shares
// are created for you. Meant for a test account only; re-running refreshes
// the notifications instead of stacking duplicates, and sends one more DM.

import "dotenv/config";
import mongoose from "mongoose";
import { connect, disconnect } from "./lib/catalogReferences.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Share from "../models/Share.js";
import { notifyFollow, notifyMessage, retractFollow, syncShareLikeNotification } from "../services/notifications.js";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const identifier = args.find((arg) => !arg.startsWith("--"));

const MESSAGE_TEXT = "Hey! Just watched The Truman Show because of you. That ending... we need to talk about it.";
const CROWD_SIZE = 10;
const SHARES_NEEDED = 2;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The target's two least-liked shares — the first is the one a single like
// will read as "C liked your share" — creating test shares for any missing.
async function ensureShares(targetId) {
  const existing = await Share.find({ user: targetId }).sort({ likeCount: 1, createdAt: -1 }).limit(SHARES_NEEDED);
  if (existing.length >= SHARES_NEEDED) return existing;

  const movie = await mongoose
    .model("Movie")
    .findOne({ poster_path: { $nin: [null, ""] } })
    .select("_id title poster_path release_date")
    .lean();
  const created = [];
  for (let i = existing.length; i < SHARES_NEEDED; i++) {
    created.push(
      await Share.create({
        user: targetId,
        type: "recommendation",
        note: "Test share from the notification seeder.",
        ...(movie && {
          contentId: String(movie._id),
          contentType: "movie",
          contentData: {
            title: movie.title,
            posterUrl: movie.poster_path,
            releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
          },
        }),
      })
    );
  }
  return [...existing, ...created];
}

// Adds the likes that aren't there yet, then brings the share's notification
// up to date as a fresh like from the last of them.
async function likeShare(shareId, likerIds) {
  for (const likerId of likerIds) {
    await Share.updateOne({ _id: shareId, likes: { $ne: likerId } }, { $push: { likes: likerId }, $inc: { likeCount: 1 } });
  }
  const share = await Share.findById(shareId);
  await syncShareLikeNotification(share, { likerId: likerIds[likerIds.length - 1], liked: true });
  return share;
}

async function main() {
  if (!identifier) {
    console.error("Usage: node scripts/seedNotifications.js <username or email> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  await connect();
  const User = mongoose.model("User");

  const exact = new RegExp(`^${escapeRegex(identifier)}$`, "i");
  const target = await User.findOne({ $or: [{ username: exact }, { email: exact }] }).select("_id username").lean();
  if (!target) throw new Error(`No account with the username or email "${identifier}".`);

  const senders = await User.find({ _id: { $ne: target._id }, username: { $exists: true, $ne: "" } })
    .sort({ _id: 1 })
    .limit(3 + CROWD_SIZE)
    .select("_id username")
    .lean();
  if (senders.length < 3 + CROWD_SIZE) throw new Error(`At least ${3 + CROWD_SIZE} other accounts are needed to send from.`);
  const [follower, messenger, liker, ...crowd] = senders;

  console.log(`${DRY_RUN ? "DRY RUN — nothing will be written. " : ""}Seeding notifications for @${target.username}:`);
  console.log(`  follow      from @${follower.username}`);
  console.log(`  message     from @${messenger.username}: "${MESSAGE_TEXT}"`);
  console.log(`  share_like  from @${liker.username} on one share`);
  console.log(`  share_like  from ${CROWD_SIZE} people (@${crowd[0].username} …) on another share`);
  if (DRY_RUN) return;

  // follow
  await User.updateOne({ _id: follower._id }, { $addToSet: { following: target._id } });
  await User.updateOne({ _id: target._id }, { $addToSet: { followers: follower._id } });
  await retractFollow({ recipientId: target._id, senderId: follower._id });
  await notifyFollow({ recipientId: target._id, senderId: follower._id });

  // message — a real DM, shaped the way conversationController creates one.
  let conversation = await Conversation.findOne({ participants: { $all: [target._id, messenger._id], $size: 2 } });
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [String(target._id), String(messenger._id)].sort(),
      unreadCounts: {},
    });
  }
  const message = await Message.create({ roomType: "dm", roomId: conversation._id, sender: messenger._id, text: MESSAGE_TEXT });
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: MESSAGE_TEXT, lastMessageAt: new Date() }, $inc: { [`unreadCounts.${target._id}`]: 1 } }
  );
  await notifyMessage({ recipientId: target._id, senderId: messenger._id, conversationId: conversation._id, message });

  // share likes
  const [singleShare, crowdShare] = await ensureShares(target._id);
  const single = await likeShare(singleShare._id, [liker._id]);
  const popular = await likeShare(crowdShare._id, crowd.map((user) => user._id));

  const likers = (share) => share.likes.filter((id) => String(id) !== String(target._id)).length;
  console.log(`\nDone. Share ${single._id} has ${likers(single)} liker(s); share ${popular._id} has ${likers(popular)}.`);
  console.log("Open Notifications in the app and pull to refresh.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(disconnect);
