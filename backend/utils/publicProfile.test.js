import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_ACCESS, PUBLIC_PROFILE } from "./publicProfile.js";

// Older app builds show a "private profile" wall unless these exact values arrive.

test("a profile always reads as public, viewable and not pending", () => {
  assert.deepEqual({ ...PUBLIC_PROFILE }, { visibility: "public", isAuthorized: true, isRequested: false });
});

test("profile data always reads as viewable", () => {
  assert.deepEqual({ ...PUBLIC_ACCESS }, { isAuthorized: true });
});

test("the flags override anything stale on a stored user document", () => {
  const stored = { _id: "u1", username: "ana", visibility: "private" };
  assert.equal({ ...stored, ...PUBLIC_PROFILE }.visibility, "public");
});

test("the shared objects can't be changed by a handler", () => {
  // Modules are strict, so writing to a frozen object throws.
  assert.throws(() => {
    PUBLIC_PROFILE.isAuthorized = false;
  });
  assert.equal(PUBLIC_PROFILE.isAuthorized, true);
});
