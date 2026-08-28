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
  // Brushed silver — light metallic gray, cool but neutral.
  pro: { gradient: ["#B8C2CE", "#8A94A6"], glowColor: "#9AA5B1" },
  // Platinum blue — steel blue easing into pale ice blue, kept soft rather
  // than a hard 2-tone split.
  premium: { gradient: ["#4A6FA0", "#B8D4EE"], glowColor: "#5B85B8" },
  // Purple -> magenta, deliberately muted (not the neon version) so it
  // reads as a distinct internal/dev marker without shouting.
  dev: { gradient: ["#8B5FBF", "#C264A0"], glowColor: "#A374B5" },
};
