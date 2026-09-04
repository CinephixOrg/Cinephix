import type { AccountTier } from "../types";

// Single source of truth for the tiered profile-picture frame's look —
// tune a tier here, nowhere else. `gradient` is the thin border ring
// (TierAvatarFrame draws it ~1.5px wide, not a filled band), `glowColor`
// drives the soft outer shadow that gives it depth without a heavy stroke.
// Free is absent on purpose — no ring, no glow — so escalation starts
// visibly at Pro instead of every account having some decoration.
interface TierFrameStyle {
  gradient: [string, string];
  glowColor: string;
}

export const TIER_FRAME_STYLES: Partial<Record<AccountTier, TierFrameStyle>> = {
  // Platinum blue — steel blue easing into pale ice blue. Moved here from
  // Premium at explicit request (a Pro/Premium color swap, back when this
  // tier was still named "pro") — carries Premium's old look.
  plus: { gradient: ["#4A6FA0", "#B8D4EE"], glowColor: "#5B85B8" },
  // Gold — moved here from the middle tier's old silver at the same
  // request, and deliberately matching ShareCard.tsx's own
  // TIER_GOLD/TIER_GOLD_HIGHLIGHT (the Premium post-box frame's exact
  // colors) so the avatar ring and the post frame read as the same
  // "Premium" gold everywhere in the app, not two different golds.
  premium: { gradient: ["#FFF3C4", "#FFC94A"], glowColor: "#FFC94A" },
  // Purple -> magenta, deliberately muted (not the neon version) so it
  // reads as a distinct internal/dev marker without shouting.
  dev: { gradient: ["#8B5FBF", "#C264A0"], glowColor: "#A374B5" },
};
