// No relative-time library or existing helper anywhere in this codebase —
// every other timestamp in the app renders via `toLocaleDateString`/
// `toLocaleTimeString` directly at the call site (ReviewCard.tsx,
// FeedItemRow.tsx, PersonalActivityRow.tsx, etc.), which reads fine for
// those (a review's/message's own detail view). The Activity feed is
// denser — many rows at a glance — where a real "2h ago" reads faster
// than a full date, so this is a small, first, purpose-built helper
// rather than a reach for a new dependency.
export function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
