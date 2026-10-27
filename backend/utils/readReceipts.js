// Read receipts: who has read a chat message, and when.
//
// A message's readBy lists everyone other than its sender who has read it,
// with the time they did. It's written when someone marks a room read
// (services/readReceipts.js) and is shown to the message's sender only: the
// ticks on their own messages and the message's info sheet.
//
// Pure and DB-free, so it runs under `node --test` (readReceipts.test.js).

const idOf = (value) => String(value?._id ?? value);

/** The ids of a room's newly read messages, grouped by who sent them — each sender is told about their own. */
export function groupBySender(messages) {
  const bySender = new Map();
  for (const message of messages) {
    const sender = idOf(message.sender);
    if (!bySender.has(sender)) bySender.set(sender, []);
    bySender.get(sender).push(String(message._id));
  }
  return bySender;
}

/**
 * Messages as one viewer should get them: readBy only on the viewer's own.
 * In a group, who read someone else's message is that person's business.
 */
export function receiptsForViewer(messages, viewerId) {
  const viewer = String(viewerId);
  return messages.map((message) => {
    if (idOf(message.sender) === viewer || !("readBy" in message)) return message;
    const { readBy: _hidden, ...rest } = message;
    return rest;
  });
}

/**
 * A DM's read receipts for messages from before receipts were recorded.
 *
 * The only record of what someone had read then is their unread count: of
 * the viewer's messages to them, all but the newest `unread` have been read
 * (every message of yours raises their count by one, and opening the chat
 * puts it back to zero). `unreadFrom` is when the oldest of those unread
 * messages was sent, or null when nothing is unread. Messages read this way
 * get a receipt with no time — when isn't known — and only in the copy
 * returned; nothing is stored.
 */
export function withInferredReads(messages, { viewerId, otherId, unreadFrom }) {
  const viewer = String(viewerId);
  const other = String(otherId);
  const cutoff = unreadFrom ? new Date(unreadFrom).getTime() : Infinity;
  return messages.map((message) => {
    if (idOf(message.sender) !== viewer) return message;
    if (message.readBy?.some((entry) => idOf(entry.user) === other)) return message;
    if (new Date(message.createdAt).getTime() >= cutoff) return message;
    return { ...message, readBy: [...(message.readBy ?? []), { user: otherId, at: null }] };
  });
}

/**
 * A message's readers for its info sheet, earliest first: people whose
 * account is gone, and people hidden from the viewer by a block, left out.
 * A receipt with no time (inferred, see above) comes first.
 */
export function visibleReaders(readBy, hiddenUsers) {
  return (readBy ?? [])
    .filter((entry) => entry?.user && !hiddenUsers?.has(idOf(entry.user)))
    .sort((a, b) => new Date(a.at ?? 0) - new Date(b.at ?? 0))
    .map((entry) => ({ user: entry.user, at: entry.at }));
}
