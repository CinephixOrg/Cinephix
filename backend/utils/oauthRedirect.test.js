import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedMobileRedirect } from "./oauthRedirect.js";

test("allows the app's own cinephix:// redirect in every environment", () => {
  assert.equal(isAllowedMobileRedirect("cinephix://oauth-success", "production"), true);
  assert.equal(isAllowedMobileRedirect("cinephix://oauth-success", "development"), true);
  assert.equal(isAllowedMobileRedirect("CINEPHIX://oauth-success", "production"), true);
});

test("allows Expo Go's exp:// redirect only outside production", () => {
  const expoGo = "exp://192.168.1.20:8081/--/oauth-success";
  assert.equal(isAllowedMobileRedirect(expoGo, "development"), true);
  assert.equal(isAllowedMobileRedirect(expoGo, undefined), true);
  assert.equal(isAllowedMobileRedirect(expoGo, "production"), false);
});

test("rejects web pages and other schemes that would leak the session token", () => {
  for (const uri of [
    "https://evil.example/steal",
    "http://localhost:5173/oauth-success",
    "javascript:alert(1)",
    "data:text/html,hi",
    "intent://oauth-success#Intent;scheme=cinephix;end",
    "exps://u.expo.dev/oauth-success",
    "//evil.example",
    "cinephix-evil://oauth-success",
  ]) {
    assert.equal(isAllowedMobileRedirect(uri, "development"), false, uri);
  }
});

test("rejects missing, malformed and oversized values", () => {
  for (const value of [undefined, null, "", "not a url", 42, ["cinephix://x"], `cinephix://${"a".repeat(3000)}`]) {
    assert.equal(isAllowedMobileRedirect(value, "development"), false, String(value).slice(0, 40));
  }
});
