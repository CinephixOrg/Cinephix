import Notification from "../models/Notification.js";
import { messagePreview, shareLikeSummary } from "../utils/notificationPayload.js";
import { pushNotification } from "./push.js";

// Every in-app notification is created, updated and removed here, so each
// type has exactly one definition of what it carries. Every one created is
// also pushed to the recipient's devices (services/push.js), in the
// background.

export async function notifyFollow({ recipientId, senderId }) {
  const notification = await Notification.create({ user: recipientId, sender: senderId, type: "follow" });
  pushNotification(notification.toObject());
  return notification;
}

export async function retractFollow({ recipientId, senderId }) {
  await Notification.deleteMany({ user: recipientId, sender: senderId, type: "follow" });
}

/**
 * A direct message. The notification carries the message's id and a preview
 * of its text, so the feed can show what was said and the push can say it
 * too, from this document alone. Returns the notification as a plain object,
 * for real-time delivery.
 */
export async function notifyMessage({ recipientId, senderId, conversationId, message }) {
  const notification = await Notification.create({
    user: recipientId,
    sender: senderId,
    type: "message",
    conversationId,
    message: { messageId: message._id, ...messagePreview(message) },
  });
  const plain = notification.toObject();
  pushNotification(plain);
  return plain;
}

/**
 * Keeps a share's "liked your share" notification in step with its likes.
 *
 * One notification per share, whatever the number of likes. A new like is new
 * activity, so the notification is recreated: it moves to the top of the
 * newest-first feed and reads as unread again. An unlike only corrects the
 * count and the latest liker, keeping its place and read state, and removes
 * the notification once no one but the author likes the share.
 *
 * `share` must be the saved document with its full `likes` array.
 */
export async function syncShareLikeNotification(share, { likerId, liked }) {
  const { likerCount, latestLikerId } = shareLikeSummary(share);
  const filter = { user: share.user, type: "share_like", "share.shareId": share._id };

  if (likerCount === 0) {
    await Notification.deleteMany(filter);
    return;
  }

  if (liked && String(likerId) !== String(share.user)) {
    await Notification.deleteMany(filter);
    try {
      const notification = await Notification.create({
        user: share.user,
        sender: likerId,
        type: "share_like",
        share: { shareId: share._id, shareType: share.type, likerCount },
      });
      // An unlike only corrects the count below, and isn't pushed.
      pushNotification(notification.toObject());
    } catch (error) {
      // A like landing at the same moment already recreated it (the index
      // allows one per share), with the same count.
      if (error?.code !== 11000) throw error;
    }
    return;
  }

  await Notification.updateOne(filter, { $set: { sender: latestLikerId, "share.likerCount": likerCount } });
}

export async function removeShareNotifications(shareId) {
  await Notification.deleteMany({ type: "share_like", "share.shareId": shareId });
}
