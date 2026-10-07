// Where the Google sign-in callback may send a mobile user's session.
//
// The callback appends the user's JWT to this URL, so it must only ever be
// the app itself: the cinephix:// scheme of a standalone or dev-client
// build, plus exp:// (Expo Go) outside production. Anything else — an
// https:// page, javascript:, a malformed value — would hand the session to
// whoever crafted the link.

const MAX_LENGTH = 2048;

export function isAllowedMobileRedirect(redirectUri, nodeEnv = process.env.NODE_ENV) {
  if (typeof redirectUri !== "string" || redirectUri.length === 0 || redirectUri.length > MAX_LENGTH) return false;
  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.protocol === "cinephix:") return true;
  if (url.protocol === "exp:") return nodeEnv !== "production";
  return false;
}
