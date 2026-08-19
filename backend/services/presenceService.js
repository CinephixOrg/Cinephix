// In-memory socket presence tracking — refcounted per user (not per socket)
// so a user connected from multiple devices/tabs only flips offline once
// every one of their sockets disconnects. Resets on server restart, doesn't
// span multiple server instances — an acceptable simplification at this
// app's scale, matching how little else here needs to be distributed.
const onlineUsers = new Map(); // userId (string) -> connection count

export function markOnline(userId) {
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
}

export function markOffline(userId) {
  const count = onlineUsers.get(userId) || 0;
  if (count <= 1) onlineUsers.delete(userId);
  else onlineUsers.set(userId, count - 1);
}

export function getOnlineUserIds() {
  return [...onlineUsers.keys()];
}
