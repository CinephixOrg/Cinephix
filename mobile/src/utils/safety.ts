// Reporting and blocking: the choices offered and the rule that hides a
// blocked person's things. Pure, so it runs under `node --test` (safety.test.mts).

export type ReportEntityType = "User" | "List" | "Review" | "Comment" | "Share" | "Message";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "spoiler" | "impersonation" | "other";

/** The reasons a report can give, in menu order, with their i18n keys. */
export const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: "spam", label: "Spam", icon: "megaphone-outline" },
  { value: "harassment", label: "Harassment or hate speech", icon: "hand-left-outline" },
  { value: "inappropriate", label: "Inappropriate content", icon: "eye-off-outline" },
  { value: "spoiler", label: "Spoiler without warning", icon: "alert-circle-outline" },
  { value: "impersonation", label: "Pretending to be someone else", icon: "person-circle-outline" },
  { value: "other", label: "Something else", icon: "ellipsis-horizontal-circle-outline" },
];

/** Impersonation only makes sense about a person, and spoilers only about written content. */
export function reasonsFor(entityType: ReportEntityType): typeof REPORT_REASONS {
  return REPORT_REASONS.filter((reason) => {
    if (reason.value === "impersonation") return entityType === "User";
    if (reason.value === "spoiler") return entityType !== "User";
    return true;
  });
}

/** i18n keys: "Report review", "Report list"… */
export const REPORT_ACTION_LABEL: Record<ReportEntityType, string> = {
  User: "Report user",
  List: "Report list",
  Review: "Report review",
  Comment: "Report comment",
  Share: "Report post",
  Message: "Report message",
};

export const MAX_REPORT_DETAILS = 1000;

/** The id of whoever made an item, from a raw id or a populated person. */
export function authorId(author: string | { _id?: string } | null | undefined): string | null {
  if (!author) return null;
  return typeof author === "string" ? author : author._id ?? null;
}

/**
 * The items not made by anyone blocked. Returns the same array when nothing
 * is removed, so memoised lists don't re-render for nothing.
 */
export function withoutBlocked<T>(items: readonly T[], authorOf: (item: T) => string | null | undefined, blocked: ReadonlySet<string>): T[] {
  if (blocked.size === 0) return items as T[];
  const kept = items.filter((item) => {
    const id = authorOf(item);
    return !id || !blocked.has(id);
  });
  return kept.length === items.length ? (items as T[]) : kept;
}
