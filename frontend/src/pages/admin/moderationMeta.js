// Shared moderation vocabulary. Mirrors backend/utils/moderationActions.js.

/** Suspension lengths the dashboard offers; "" means permanent. */
export const SUSPENSION_DURATIONS = [
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
  { value: "", label: "Permanent" },
];

/** Report entity types that can actually be deleted, and the API's name for each. */
export const DELETABLE = { Review: "review", Share: "share", List: "list", Message: "message" };
