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
  // Silver — was matching PeoplePodiumCard.tsx's own rank-2 medal pair
  // (MEDAL_COLORS[2]/MEDAL_HIGHLIGHT_COLORS[2], two close, low-saturation
  // grays) verbatim, which read as flat/washed out rather than metallic —
  // direct report that gold's own contrast (near-white to a properly
  // saturated gold) "feels" like metal while this didn't. Widened the
  // tonal range the same way (near-white highlight to a clearly darker,
  // cool-toned steel gray) rather than adding more gradient stops — same
  // 2-stop formula gold already uses, just with silver's own hue instead
  // of gold's. PeoplePodiumCard.tsx's own MEDAL_COLORS[2]/LeaderboardCard's
  // matching copy are separate, rank-based (not tier-based) constants by
  // this app's own established "don't share a small repeated pattern"
  // convention — deliberately left untouched, this was specifically about
  // the tier ring/gradient-name pair.
  plus: { gradient: ["#FAFBFC", "#6E7580"], glowColor: "#9099A6" },
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
