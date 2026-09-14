import { asyncHandler } from "../middleware/errorHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { isExpoPushToken, parseRegistration } from "../utils/pushMessages.js";
import { removePushToken, savePushToken } from "../services/push.js";

// This device's Expo push token, registered on sign-in (and whenever the token
// or the app's language changes) and removed on sign-out.

// @route POST /api/users/me/push-tokens   { token, platform, locale, deviceName }
export const registerPushToken = asyncHandler(async (req, res) => {
  const registration = parseRegistration(req.body);
  if (!registration) return sendError(res, "A valid Expo push token is required", 400);
  await savePushToken(req.user._id, registration);
  sendSuccess(res, null, "Push token registered", 200);
});

// @route DELETE /api/users/me/push-tokens/:token
export const unregisterPushToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!isExpoPushToken(token)) return sendError(res, "A valid Expo push token is required", 400);
  await removePushToken(req.user._id, token);
  sendSuccess(res, null, "Push token removed", 200);
});
