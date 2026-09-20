import { stripHidden } from "../utils/blockFilter.js";
import User from "../models/User.js";
import { sendError } from "../utils/response.js";

// Blocked people are invisible to each other, everywhere.
//
// `hideBlockedContent` is registered once, before every route: it wraps
// res.json so any list in any response loses the entries that are, or were
// made by, someone hidden from the viewer (utils/blockFilter.js). Feeds,
// search, leaderboards, member lists, inboxes and notifications are all
// covered by this one rule, including endpoints written later. The hidden
// set comes from the auth middleware (req.hiddenUsers); a request without a
// signed-in user, or a user with no blocks, goes out untouched and unparsed.
//
// Routes that return one thing by a person's id use `notHiddenUser` instead,
// so a blocked profile reads as not found rather than as an empty page.

export function hideBlockedContent(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    const hidden = req.hiddenUsers;
    if (!hidden || hidden.size === 0 || req.skipBlockFilter || body == null || typeof body !== "object") return json(body);
    // Round-trip to plain JSON first: responses can hold Mongoose documents,
    // whose internals aren't safe to walk. Only paid by users with blocks.
    return json(stripHidden(JSON.parse(JSON.stringify(body)), hidden));
  };
  next();
}

/** 404s when the person named by this route param is hidden from the viewer. */
export function notHiddenUser(param = "id") {
  return (req, res, next) => {
    const id = req.params[param];
    if (id && req.hiddenUsers?.has(String(id))) return sendError(res, "User not found", 404);
    next();
  };
}

/**
 * For a profile route: someone you blocked yourself answers with just
 * enough to show "You blocked this user" and an Unblock button — their name
 * and picture, nothing they've made. Someone who blocked you stays not found
 * (notHiddenUser, which runs next).
 */
export function blockedProfileStub(param = "id") {
  return async (req, res, next) => {
    const id = req.params[param];
    if (!id || !req.blockedByMe?.has(String(id))) return next();
    try {
      const user = await User.findById(id).select("username profile_pic_url accountTier").lean();
      if (!user) return sendError(res, "User not found", 404);
      req.skipBlockFilter = true;
      const { _id, username, profile_pic_url, accountTier } = user;
      return res.status(200).json({ _id, username, profile_pic_url, accountTier, isBlockedByMe: true });
    } catch (err) {
      return next(err);
    }
  };
}
