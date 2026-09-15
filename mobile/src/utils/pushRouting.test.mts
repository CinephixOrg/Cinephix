import test from "node:test";
import assert from "node:assert/strict";
import { isForActiveChat, isForViewer, parsePushData, toRoutable } from "./pushRouting.ts";
import { destinationFor, hrefFor } from "./notificationFeed.ts";

const ME = "6a0000000000000000000abc";
const SENDER = { _id: "691f53a845194a18bc31db24", username: "ana", profile_pic_url: "https://img.example/ana.jpg" };
const SHARE_ID = "6a7f855f9484891206f30637";

// What backend/utils/pushMessages.js pushData sends.
const messagePush = {
  notificationId: "n1",
  recipientId: ME,
  type: "message",
  senderId: SENDER._id,
  senderUsername: SENDER.username,
  senderAvatar: SENDER.profile_pic_url,
  conversationId: "c1",
};

const routeOf = (raw: unknown, viewerId = ME) => {
  const data = parsePushData(raw);
  return data && isForViewer(data, viewerId) ? hrefFor(destinationFor(toRoutable(data), viewerId)) : null;
};

// ---- Parsing -------------------------------------------------------------------

test("reads our push data and keeps only its string fields", () => {
  assert.deepEqual(parsePushData({ ...messagePush, extra: "x", senderAvatar: 42 }), {
    type: "message",
    notificationId: "n1",
    recipientId: ME,
    senderId: SENDER._id,
    senderUsername: "ana",
    conversationId: "c1",
  });
});

test("accepts the data as a JSON string", () => {
  assert.equal(parsePushData(JSON.stringify(messagePush))?.conversationId, "c1");
});

test("ignores anything that isn't one of ours", () => {
  for (const raw of [null, undefined, "", "not json", 7, {}, { type: "follow_request" }, { type: 1 }]) {
    assert.equal(parsePushData(raw), null, JSON.stringify(raw));
  }
});

// ---- Routing: the same screens the in-app feed opens -----------------------------

test("a message push opens the chat with its sender, named from the first frame", () => {
  const inFeed = hrefFor(destinationFor({ type: "message", sender: SENDER }, ME));
  assert.deepEqual(routeOf(messagePush), inFeed);
  assert.deepEqual(routeOf(messagePush), {
    pathname: "/user/[id]/chat",
    params: { id: SENDER._id, otherUsername: "ana", otherAvatar: SENDER.profile_pic_url },
  });
});

test("a follow push opens the follower's profile", () => {
  assert.deepEqual(routeOf({ type: "follow", recipientId: ME, senderId: SENDER._id, senderUsername: "ana" }), {
    pathname: "/user/[id]",
    params: { id: SENDER._id },
  });
});

test("a share like push opens that share in the viewer's own profile stack", () => {
  const push = { type: "share_like", recipientId: ME, senderId: SENDER._id, shareId: SHARE_ID };
  const inFeed = hrefFor(destinationFor({ type: "share_like", sender: SENDER, share: { shareId: SHARE_ID } }, ME));
  assert.deepEqual(routeOf(push), inFeed);
});

test("a push for another account, or with no one signed in, opens nothing", () => {
  assert.equal(routeOf(messagePush, "someone-else"), null);
  const data = parsePushData(messagePush)!;
  assert.equal(isForViewer(data, null), false);
  assert.equal(isForViewer({ ...data, recipientId: undefined }, ME), true);
});

test("a push missing what its screen needs opens nothing", () => {
  assert.equal(routeOf({ type: "message", recipientId: ME }), null);
  assert.equal(routeOf({ type: "share_like", recipientId: ME, senderId: SENDER._id }), null);
});

// ---- Foreground ----------------------------------------------------------------

test("a message for the chat on screen needs no banner; anything else does", () => {
  const data = parsePushData(messagePush)!;
  assert.equal(isForActiveChat(data, { conversationId: "c1", participantId: null }), true);
  assert.equal(isForActiveChat(data, { conversationId: null, participantId: SENDER._id }), true);
  assert.equal(isForActiveChat(data, { conversationId: "c2", participantId: "someone" }), false);
  assert.equal(isForActiveChat(data, null), false);
  assert.equal(isForActiveChat({ type: "follow", senderId: SENDER._id }, { conversationId: null, participantId: SENDER._id }), false);
});
