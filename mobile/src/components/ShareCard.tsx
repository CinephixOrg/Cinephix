import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Modal,
  ScrollView as RNScrollView,
  useWindowDimensions,
} from "react-native";

// From react-native-gesture-handler, not react-native: ShareCard renders
// inside SharesFeedSection.tsx's vertical FlatList, itself nested inside
// home/index.tsx's horizontal gesture-handler pager — the list-post film
// strip below is a new horizontal scroller in that same ancestor chain, so
// it needs to share the gesture-handler resolution system the same way
// PeoplePodium/ContentRail/LeaderboardPodium already do, or its own drag
// just gets eaten by the outer pager (see home/index.tsx's own comment).
// GHPressable specifically for the list-post box's own outer Pressable —
// a real bug (not just the ScrollView import) turned out to also need
// this: a *plain* react-native Pressable directly wrapping a
// gesture-handler ScrollView doesn't participate in gesture-handler's own
// touch negotiation at all (different systems), so the drag kept getting
// claimed by the outer Medya pager instead of ever reaching the strip.
// Every Pressable directly ancestor to a gesture-handler scroller needs to
// itself be gesture-handler's version, not just the scroller — plain
// react-native's `Pressable` (imported below) is still fine for every
// *other* Pressable in this file that doesn't wrap a nested scroller.
import { ScrollView, Pressable as GHPressable } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import StackedAvatars from "./StackedAvatars";
import TierGradientText from "./TierGradientText";
import { CASCADE_POSTER_RADIUS } from "./PosterCascade";
import StarRatingDisplay from "./StarRatingDisplay";
import FollowButton from "./FollowButton";
import { registerShareView, voteOnPoll } from "../api/shareService";
import { addToToWatchList } from "../api/toWatchService";
import type { OfficialContentCategory, PollOption, Share } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useWatchlistGraph, isInWatchlistGraph } from "../context/WatchlistGraphContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";

// Was w500 (500px wide) — every actual use of this in the file is a small
// thumbnail (48-64px wide: sharePoster, filmStripPoster, modalPoster), so
// every post in the feed was downloading/decoding ~7-8x more pixel data
// than it ever displays. w185 comfortably covers all three at retina
// density (matches the precedent already set for similarly-sized
// thumbnails elsewhere, e.g. Search's own SearchContentRow using w154 for
// a 52px poster).
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
// Same 2:3 poster aspect ratio used everywhere else in this app — the
// list-post box's own "film strip" (see filmStripPoster below).
const FILM_STRIP_POSTER_WIDTH = 56;
const FILM_STRIP_POSTER_HEIGHT = FILM_STRIP_POSTER_WIDTH * 1.5;

// Same hand-picked gold pair as the Sync profile cloud's rank-1 medal
// badge (MatchAvatarRing.tsx) — reused here rather than picked fresh, so
// "gold" reads consistently as this app's one "special" accent color.
// Premium-only glowing box (Pro doesn't get it) — unrelated to tier
// *identity* now that that's shown via UserAvatar's own TierAvatarFrame
// ring + the inline tierMark below, both colored per-tier from
// tierFrames.ts rather than this gold.
const TIER_GOLD = "#FFC94A";
const TIER_GOLD_HIGHLIGHT = "#FFF3C4";
// Same highlight-+-base gradient pairing idea as the gold pair above, just
// in the like sticker's own red — a soft pink highlight easing into
// colors.error (theme-dependent, so read live via useTheme() rather than
// hardcoded here). Fills the sticker's own custom SVG heart path when
// liked (a real gradient fill on the heart shape itself, not a ring or
// frame around it — a first pass wrapped the heart in a separate gradient-
// stroke ring, which the user explicitly didn't want).
const LIKE_RING_HIGHLIGHT = "#FFB3C1";
// Same "light highlight fading into the saturated brand color" gradient
// idea as the heart above, for the watchlist sticker's own plus shape —
// white works as a highlight against any theme's own wildly different
// primary hue (green/purple/pink/orange/...), unlike trying to pick one
// fixed highlight color that would clash with several of them.
const WATCHLIST_RING_HIGHLIGHT = "#FFFFFF";
// Shared by shareBox and analysisBox — both are the app's "inner content
// box" convention now (colors.base200 on the colors.base100 page), so the
// Premium gold border/shadow wraps just that box, not the whole flush post.
const INNER_BOX_RADIUS = 12;

// Caps a review-share's excerpt so the box's own height stays fixed
// regardless of review length — a long review is truncated with an
// ellipsis at this many lines; tapping it opens the full text in a Modal.
const REVIEW_COLLAPSED_LINES = 3;

interface Props {
  share: Share;
  // Takes the share's own id rather than being pre-bound to it — lets every
  // caller pass one stable ([]) function reference instead of a fresh
  // inline arrow per card, which is what actually lets this component's own
  // React.memo (below) skip re-rendering an untouched card when a sibling
  // card's like state changes or an unrelated ancestor re-renders.
  onToggleLike: (shareId: string) => void;
  basePath: "/home" | "/profile" | `/user/${string}`;
}

const OFFICIAL_CATEGORY_META: Record<OfficialContentCategory, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  trivia: { icon: "sparkles", label: "Trivia" },
  tip: { icon: "bulb", label: "Tip" },
  highlight: { icon: "trophy", label: "Highlight" },
  on_this_day: { icon: "calendar", label: "On This Day" },
  stats: { icon: "stats-chart", label: "Stats" },
  announcement: { icon: "megaphone", label: "Announcement" },
};

export function typeMeta(type: Share["type"], colors: ColorPalette, t: (k: string) => string, officialCategory?: OfficialContentCategory) {
  switch (type) {
    case "analysis":
      return { icon: "sparkles" as const, label: t("Analysis"), color: colors.secondary };
    case "review":
      return { icon: "pencil" as const, label: t("Review"), color: colors.info };
    case "recommendation":
      return { icon: "gift" as const, label: t("Recommendation"), color: colors.warning };
    case "list":
      return { icon: "albums-outline" as const, label: t("List"), color: colors.accent };
    case "official": {
      const m = (officialCategory && OFFICIAL_CATEGORY_META[officialCategory]) || OFFICIAL_CATEGORY_META.trivia;
      return { icon: m.icon, label: t(m.label), color: colors.info };
    }
    case "poll":
      return { icon: "bar-chart" as const, label: t("Poll"), color: colors.secondary };
    // Share["type"] is a compile-time guarantee only — a doc with a bad/
    // missing type field (legacy data, a partially-migrated record) would
    // otherwise fall through to `undefined` here and crash every reader
    // (ShareCard, ShareGridTile) on `meta.color`/`meta.icon`/`meta.label`.
    default:
      return { icon: "help-circle" as const, label: t("Share"), color: colors.placeholder };
  }
}

// Links just the one word "watchlist" inline within the recommendation
// sentence — plain nested Text with its own onPress (no wrapping
// Pressable), the shape already confirmed live to render on-baseline
// correctly for this specific card, unlike the inline-Pressable-in-Text
// alternative tried once and reverted. Case-insensitive match so it still
// finds the word regardless of the sentence's own casing; a custom
// `share.note` that never mentions "watchlist" simply renders unlinked.
function renderRecommendMessage(text: string, linkText: string, style: any, onPress: () => void) {
  const idx = text.toLowerCase().indexOf(linkText.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Text style={style} onPress={onPress}>
        {text.slice(idx, idx + linkText.length)}
      </Text>
      {text.slice(idx + linkText.length)}
    </>
  );
}

// General N-link version of renderRecommendMessage above — official posts
// need more than one linked word (trivia's same-day-release template links
// BOTH titles at once), which a single linkText/onPress pair can't express.
// Kept as a separate function rather than generalizing renderRecommendMessage
// itself, since that one has its own single-link call site (the
// recommendation type's "Watchlist" word) that works fine as-is. Words are
// matched case-insensitively, first occurrence, non-overlapping (a match
// starting before the previous match's own end is skipped) — good enough
// for short auto-generated sentences where each linked word appears once.
function renderTextWithLinks(text: string, links: { word: string; onPress: () => void }[], style: any) {
  const matches = links
    .map((l) => ({ ...l, idx: text.toLowerCase().indexOf(l.word.toLowerCase()) }))
    .filter((l) => l.idx !== -1)
    .sort((a, b) => a.idx - b.idx);
  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.idx < cursor) return;
    nodes.push(text.slice(cursor, m.idx));
    nodes.push(
      <Text key={i} style={style} onPress={m.onPress}>
        {text.slice(m.idx, m.idx + m.word.length)}
      </Text>
    );
    cursor = m.idx + m.word.length;
  });
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

// Pasted flat onto the page (no card background of its own — same
// colors.base100 as the page behind it), a hairline divider between posts.
// All 4 types share the same header (avatar+username+inline tier mark+
// FollowButton, self-hiding on the viewer's own posts). The colored type
// badge (Analysis/Review/Recommendation/List) sits in the header too,
// right under the username. Like and view are no longer one shared row:
// view (icon or a StackedAvatars strip of recent viewers + count) stays in
// the footer, bottom-left; like is its own floating, rotated corner
// sticker pinned to the card's own bottom-right edge, plus a double-tap-
// to-like burst on the content box itself (see this component's own
// double-tap handling below) — both per the user's own explicit
// redesign ask, not just an inline row anymore.
// Review and Recommendation share one boxed poster+title+message row
// (`shareBox` — a link-preview-card shape, reusing the app's own
// contained-poster convention from FeedItemRow/MyListCard) — Review's
// message is the review text itself when present, otherwise a plain
// "shared a review" sentence; Recommendation's is the sharer's custom
// note, otherwise a promotional fallback sentence. List gets its own
// `listBox` — same colors.base200 "inner content box" language but a
// vertical stack (name, description/fallback, a horizontal poster strip)
// since a list's preview is inherently multiple posters, not one — always
// the owner's own public list, snapshotted at share time (see
// ListDetailScreen.tsx's handleShareToMedia). Analysis uses its own
// nickname+summary `analysisBox`, styled the same way for consistency.
// Tier shows two ways, both sourced from the same tierFrames.ts colors so
// they read as one consistent language rather than two competing rules:
// UserAvatar's own TierAvatarFrame ring (silver/blue/purple per tier, a
// teammate's own component — always passed now, not gated behind a
// showTierFrame flag, so it renders the same in Home's feed and Profile's)
// plus this card's own inline `tierMark` diamond next to the username, in
// that same tier's color — a second, more legible copy of the same signal
// since the ring itself is a thin 1.5px border easy to miss while
// scrolling fast. Premium's inner content box still gets its own separate
// gold border+glow on top of both (unrelated axis: "flashier post box" vs
// "who posted it"), unchanged from before.
function ShareCard({ share, onToggleLike, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const watchlistGraph = useWatchlistGraph();
  const { height: screenHeight } = useWindowDimensions();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // No own marginBottom/divider — spacing and the dividing line
        // between rows are both handled by SharesFeedSection.tsx's
        // FlatList `ItemSeparatorComponent` now, which renders between
        // *every* pair of adjacent rows regardless of kind (post-to-post,
        // post-to-suggested-box, suggested-box-to-post) — a border baked
        // into `card` itself only ever appeared between two posts, not
        // around the Suggested Users box.
        card: {
          backgroundColor: colors.base100,
        },
        // Absolutely-filled hollow-rect overlay, sized to whichever inner
        // box it's placed inside (shareBox or analysisBox) — not the whole
        // card. Percentage Rect dimensions inside it resolve against this
        // box's own RN-layout size, no pixel measurement needed. No more
        // separate View-level `shadow*`/`elevation` glow (the old
        // `premiumInnerBox`) — a real RN shadow only ever blurs *outward*
        // past the element's own bounds, which is exactly what kept
        // reading as a gap/overflow between the crisp gold line and its
        // own glow, however tightly it was tuned. The glow is now a second
        // stroke drawn inside this same Svg, sharing the identical x/y/
        // width/height/rx as the crisp line below it — same geometry, so
        // there's no gap between them, and neither can ever spill past
        // the box's own true edge, since both live inside its bounds.
        premiumBorderSvg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
        headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
        headerTextCol: { flex: 1 },
        // The "X shared a list/review" label between the header and the
        // box (list/review only) — same horizontal inset as the box below
        // it (marginHorizontal:12) so the two align, sitting directly on
        // the card's own background rather than a box's, hence no
        // background/padding of its own.
        // marginHorizontal a little past the box's own 12 below it — direct
        // ask to bring it in slightly rather than sit flush with the box's
        // own edge.
        // Username + tier mark share one row — a second, more legible
        // signal alongside UserAvatar's own ring (thin, 1.5px, easy to
        // miss scrolling fast) using the exact same per-tier color, not a
        // fresh one, so the two read as one consistent language rather
        // than two different rules.
        usernameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        // flexShrink so a long username truncates (numberOfLines={1} on the
        // Text itself) instead of pushing the type chip off-screen — the
        // chip now sits inline on this same row (moved off its own line
        // below, direct ask), so this row now needs to share width between
        // a variable-length name and a fixed-size chip.
        username: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, flexShrink: 1 },
        // The official account's own display name ("CINEPHIX") only.
        usernameOfficial: { fontFamily: fonts.boldItalic },
        // Moved here from the footer (where it sat right-aligned opposite
        // like/view) — now occupies the header slot the old tier *badge*
        // used to (a filled "PRO"/"PREMIUM" pill), which itself shrank
        // down to just the inline mark on the username row above.
        typeChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
          marginTop: 3,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 8,
        },
        typeChipText: { fontFamily: fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 0.3 },
        analysisBox: {
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 6,
          backgroundColor: colors.base200,
          borderRadius: INNER_BOX_RADIUS,
          padding: 14,
        },
        analysisNickname: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
        analysisSummary: { fontSize: 13, color: colors.baseContent, marginTop: 6, lineHeight: 18 },
        captionLink: { color: colors.primary },
        // The official Cinephix account's own text-only post box (trivia/
        // tip/highlight/on-this-day/stats/announcement) — same
        // colors.base200 "inner content box" convention as analysisBox,
        // with an optional poster+title row (shareBox's own row shape)
        // slotted in above the text when a specific title is referenced.
        // (A dark-metallic gradient version of this box was tried and
        // reverted the same day, per direct ask — "diğer postlar gibi
        // olsun" — back to the plain convention every other post type uses.)
        officialBox: {
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 6,
          backgroundColor: colors.base200,
          borderRadius: INNER_BOX_RADIUS,
          padding: 14,
        },
        officialContentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
        officialText: { fontSize: 13.5, color: colors.baseContent, lineHeight: 19 },
        // Trivia and Tip posts specifically (not highlight/on-this-day/
        // stats/announcement) — direct ask, bold+italic to read as more
        // distinct/editorial than a plain fact/tip would otherwise.
        officialTextEmphasis: { fontFamily: fonts.boldItalic },
        // A poll's own box — same outer convention as officialBox, holding
        // the question text plus one row per option (tappable buttons
        // pre-vote, animated percentage bars post-vote).
        pollBox: {
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 6,
          backgroundColor: colors.base200,
          borderRadius: INNER_BOX_RADIUS,
          padding: 14,
          gap: 10,
        },
        pollQuestion: { fontFamily: fonts.boldItalic, fontSize: 14.5, color: colors.baseContent, lineHeight: 20 },
        // Was gap:8 with 10px vertical padding per row — reported live as
        // "too chunky," slimmed down to a tighter, more refined stack.
        pollOptionsCol: { gap: 6 },
        pollOptionButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingVertical: 7,
          paddingHorizontal: 12,
        },
        pollOptionButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        // Post-vote: a track (colors.base300) with a fill (colors.primary)
        // growing to the option's own live percentage, label+voter
        // avatars+percent overlaid on top — Instagram-style live results.
        pollResultTrack: {
          borderRadius: 8,
          backgroundColor: colors.base300,
          overflow: "hidden",
          justifyContent: "center",
        },
        pollResultFill: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: colors.primary,
          opacity: 0.28,
        },
        pollResultRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 7,
          paddingHorizontal: 12,
        },
        pollResultLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent, flexShrink: 1, marginRight: 6 },
        pollResultLabelChosen: { fontFamily: fonts.bold },
        // Groups the voter-avatar preview and the percentage at the row's
        // own trailing edge — the label above is the only thing that
        // flex-shrinks, so this pair never gets squeezed by a long option.
        pollResultTrailing: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
        pollResultPercent: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        pollVoteCountLine: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder, marginTop: 2 },
        // Just the view row lives here now — like moved out entirely to
        // its own floating corner sticker (see likeSticker below), and the
        // dark grouped-pill background from the previous round is gone
        // per direct follow-up feedback (the user never liked it).
        footer: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingBottom: 12,
          paddingTop: 2,
        },
        viewRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        viewCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        viewAvatarRow: { flexDirection: "row", alignItems: "center" },
        // Styled as one more avatar in the chain, not a badge stuck on a
        // corner — same cutout-ring border, same -8 overlap margin
        // StackedAvatars' own internal `avatar` style uses for its avatars.
        // Real total render size 22px (18px UserAvatar content + 2px
        // border each side) *there* because that wrapper has no width/
        // height of its own, just border added around its child's
        // intrinsic size. This element sets width/height explicitly, and
        // RN's layout treats an explicit width/height + borderWidth on the
        // *same* node as border-box — the border eats into the specified
        // box instead of adding to it — so the first pass (width/height:18
        // here too) rendered a visibly smaller 18px circle next to the
        // sibling's real 22px ones, exactly the bug reported. Sized to 22
        // directly so the *outer* box matches, border-box math and all.
        viewEyeAvatar: {
          width: 22,
          height: 22,
          marginLeft: -8,
          borderRadius: 11,
          backgroundColor: colors.placeholder,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base100,
        },
        // Bottom-right corner of the whole card, pushed toward the actual
        // corner (past the edge, not deep into the box) specifically so it
        // doesn't sit on top of the box's own text content, which runs
        // closer to the middle/left. Riding up over the content box's own
        // bottom edge is still fine/wanted — just not so deep as before.
        // Casually tilted, no background pill (bare icon+count, same
        // "remove the button chrome" ask as the view row above). No
        // `transform` here — the rotate combines with the tap-bounce scale
        // inline, since RN style arrays replace `transform` wholesale
        // rather than merging it.
        likeSticker: { position: "absolute", bottom: 18, right: -4, alignItems: "center" },
        likeStickerHeartWrap: { width: 36, height: 36 },
        // Glow only applies once actually liked — an unliked gray heart
        // shouldn't glow.
        likeStickerGlow: {
          shadowColor: colors.error,
          shadowOpacity: 0.55,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        // Fixed height (not just fontSize) so this reserves identical
        // space whether visible or opacity-hidden — a variable-height row
        // here is exactly what caused the heart to shift.
        likeStickerCount: {
          fontFamily: fonts.bold,
          fontSize: 12,
          lineHeight: 14,
          height: 14,
          color: "#fff",
          marginTop: -2,
          textShadowColor: "rgba(0,0,0,0.5)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        },
        // Recommendation-only sibling of likeSticker above, same floating
        // tilted-badge language — a bare shape, no circle/pill background,
        // matching the heart's own bare-SVG-glyph treatment exactly rather
        // than a filled button. `bottom:30` (not likeSticker's 18) is
        // deliberate: likeSticker's own column also reserves space below
        // the heart for its like-count text, which pushes the heart glyph
        // itself higher than its container's bottom edge — this sticker
        // has no count row, so its own bottom needs raising by that same
        // ~12px (the count text's reserved height) for the two glyphs'
        // vertical centers to actually land on the same line.
        watchlistSticker: { position: "absolute", bottom: 30, right: 40, alignItems: "center" },
        // The frame itself is drawn in the SVG below (a stroke that hugs
        // the plus's own real silhouette), not a generic circle here — a
        // first attempt used a plain circular CSS border on this wrap,
        // which the user corrected: they wanted the frame to trace the
        // shape's own edges, same idea as the list-post film strip's own
        // border following its content's silhouette rather than a
        // container shape unrelated to what's inside it.
        watchlistStickerWrap: { width: 36, height: 36 },
        // Instagram-style double-tap-to-like burst — centered over
        // whichever content box was tapped, white so it reads over any
        // poster/photo background (the shareBox/analysisBox/listBox this
        // sits inside all vary in what's behind them). pointerEvents:
        // "none" so it never blocks a second real double-tap from landing.
        burstOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        // Shared dark drop-shadow for legibility over any background —
        // used by the burst heart.
        heartShadow: {
          textShadowColor: "rgba(0,0,0,0.35)",
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        },
        // Shared by Recommendation AND Review: header row is the same
        // avatar+username+badge+FollowButton shape as Analysis, followed by
        // one boxed, tappable poster+title+message row (a link-preview-card
        // shape, reusing the app's own contained-poster convention from
        // FeedItemRow/MyListCard instead of the previous full-bleed crop),
        // then the shared like/view footer. Top-aligned (not centered).
        // Review text specifically is capped at REVIEW_COLLAPSED_LINES (see
        // below) so post height stays fixed regardless of review length —
        // a long review is truncated with an ellipsis; tapping it opens a
        // full-text Modal instead, same pattern as Discover's own
        // ReviewSwipeCard.tsx popup.
        shareBox: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 6,
          padding: 10,
          backgroundColor: colors.base200,
          borderRadius: INNER_BOX_RADIUS,
        },
        sharePoster: { width: 64, height: 96, borderRadius: 6, backgroundColor: colors.base300, overflow: "hidden" },
        shareTextCol: { flex: 1, gap: 4, paddingTop: 2 },
        shareTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        shareMessage: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, lineHeight: 17 },
        shareMessageItalic: { fontFamily: fonts.italic, color: colors.baseContent },
        shareRatingRow: { marginTop: 1 },
        // List-only: same outer box treatment as shareBox (colors.base200,
        // INNER_BOX_RADIUS, same margins) but a vertical stack — title,
        // description/fallback, then a horizontal poster strip — instead
        // of shareBox's row layout (one poster beside one text column),
        // since a list's preview is inherently multiple posters, not one.
        listBox: {
          flexDirection: "column",
          gap: 6,
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 6,
          padding: 10,
          backgroundColor: colors.base200,
          borderRadius: INNER_BOX_RADIUS,
        },
        listCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        // "Film strip" poster row for the list-post box — replaced the
        // shared PosterCascade (overlapping/offset stack) per direct ask:
        // posters sit flush edge-to-edge with zero gap between them and the
        // row scrolls, rather than fitting only as many as the row's own
        // width allows. No `gap` on the ScrollView's content and no
        // `borderRadius`/margin on each poster — a rounded corner at every
        // poster boundary would read as a seam/gap even with zero actual
        // spacing, which defeats the point of a continuous strip. Rounding
        // only the *outer* ends of the whole strip (not each poster) and
        // the thin outline both live on `filmStripContainer` below instead
        // — `overflow:"hidden"` there clips the strip's own rounded shape,
        // so only the first/last poster's outer edge actually gets curved;
        // every seam between posters stays a flush straight line.
        filmStripContainer: { borderRadius: CASCADE_POSTER_RADIUS, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
        // `overflow:"hidden"` here specifically (not just on the outer
        // strip container above) — real bug: `resizeMode="cover"` scales a
        // poster up to fully cover its own box, which by design can render
        // a sliver past that box's true edge when the source image's own
        // aspect ratio doesn't land on exactly 2:3. With zero gap between
        // posters, that sliver bled onto the *next* poster and covered
        // part of it — which is what read as "some posters missing" in
        // some lists (the ones whose real image dimensions happened to
        // miss 2:3 by enough to matter), not an actual data problem — every
        // real `poster_path` in this app's own share feed is populated.
        filmStripPoster: { width: FILM_STRIP_POSTER_WIDTH, height: FILM_STRIP_POSTER_HEIGHT, backgroundColor: colors.base300, overflow: "hidden" },
        filmStripFallback: { alignItems: "center", justifyContent: "center" },
        filmStripFallbackText: { color: colors.placeholder, fontSize: 9, textAlign: "center", paddingHorizontal: 3 },
        // Full-review popup — same visual language and structure as
        // Discover's ReviewSwipeCard.tsx modal (poster hero, title,
        // reviewer row, rating, scrollable full text). modalCloseZone is a
        // separate absolutely-positioned sibling behind modalCard, not a
        // Pressable ancestor of the ScrollView — an ancestor Pressable
        // there is what broke that popup's own scrolling once already.
        modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        modalCloseZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        modalCard: { backgroundColor: colors.base200, borderRadius: 16, padding: 16, maxHeight: screenHeight * 0.8, overflow: "hidden" },
        modalPosterSection: { alignItems: "center" },
        modalPoster: { width: 48, height: 72, borderRadius: 6, backgroundColor: colors.base300 },
        modalContentTitle: { marginTop: 8, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, textAlign: "center" },
        modalReviewerRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
        modalUsername: { marginLeft: 6, fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent },
        modalRatingRow: { marginLeft: 8 },
        modalScroll: { flexShrink: 1 },
        modalQuote: { marginTop: 10, fontFamily: fonts.italic, fontSize: 14, lineHeight: 21, color: colors.baseContent },
      }),
    [colors, screenHeight]
  );

  const goToContent = () => {
    if (share.contentId && share.contentType) {
      router.push(`${basePath}/content/${share.contentType}/${share.contentId}` as any);
    }
  };
  const goToList = () => {
    if (share.listId) router.push(`${basePath}/lists/${share.listId}` as any);
  };

  const likeBounce = useRef(new Animated.Value(1)).current;
  const handleLikePress = () => {
    onToggleLike(share._id);
    likeBounce.setValue(1.4);
    Animated.spring(likeBounce, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  };

  // The corner heart's own "coloring in" — reported live as feeling
  // disconnected from the center double-tap burst, since the fill used to
  // just snap instantly to red the moment `share.liked` flipped, while the
  // burst takes a few hundred ms to spring into view; an instant cut next
  // to a gradual reveal never reads as "at the same time" even when both
  // technically start on the same frame. Driven off `share.liked` directly
  // (not the double-tap handler) so it animates the same way whichever path
  // triggered it — a direct tap on this sticker, or a double-tap on the
  // content box — rather than only syncing on one of the two.
  const likeColorAnim = useRef(new Animated.Value(share.liked ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(likeColorAnim, {
      toValue: share.liked ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [share.liked, likeColorAnim]);

  // Same tap-bounce as the like sticker, for the watchlist sticker's own
  // "effect" — fires on every tap, not just the first, since it's just a
  // satisfying press response independent of addedToWatchlist's own
  // one-time success state.
  const watchlistBounce = useRef(new Animated.Value(1)).current;
  const handleWatchlistStickerPress = () => {
    watchlistBounce.setValue(1.4);
    Animated.spring(watchlistBounce, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
    addRecommendedToWatchlist();
  };

  // Instagram-style double-tap-to-like on the post's own content box.
  // Manual double-tap detection (no gesture library elsewhere in this
  // app to reach for) rather than firing the box's normal single-tap
  // action immediately: a genuine double-tap needs a brief window to
  // detect the second tap, so the single-tap action (navigate to content,
  // open the list, ...) is deliberately delayed by that same window and
  // cancelled if a second tap arrives in time — the standard trade-off
  // for this gesture, not a bug. Double-tap always *adds* a like, never
  // removes one (matches Instagram's own behavior), but still plays the
  // burst animation even if already liked — it's feedback for the tap,
  // not just the state change.
  // 250ms was reported live as too tight — a real, if slightly unhurried,
  // double-tap often lands its second tap just past that window, which
  // read as "my double-tap sometimes just navigates away instead." Widened
  // to 350ms, closer to how these gestures actually land in practice.
  const DOUBLE_TAP_WINDOW_MS = 350;
  const lastTapAtRef = useRef(0);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showBurst, setShowBurst] = useState(false);
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const [fullReviewVisible, setFullReviewVisible] = useState(false);
  const [addedToWatchlist, setAddedToWatchlist] = useState(false);
  const watchlistOpacity = useRef(new Animated.Value(1)).current;
  const watchlistDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real bug this fixes: `addedToWatchlist` used to be a purely local "did
  // *this* card's own button get tapped" flag, with no idea whether the
  // content was already in the viewer's Watchlist via some *other* post
  // recommending the same title. Adding it from one post left every other
  // already-mounted post for that same title still showing its own live
  // "+" — tapping it there hit the backend's duplicate-add rejection
  // (409 "Already in watchlist") and surfaced as a confusing generic error.
  // watchlistGraph is the shared, app-wide membership set (same shape as
  // FollowGraphContext) — every card reads from it and writes to it, so
  // acting on one is reflected on every other instance of the same content.
  const isInWatchlist =
    share.contentId && share.contentType ? isInWatchlistGraph(watchlistGraph.itemIds, share.contentId, share.contentType) : false;
  useEffect(() => {
    watchlistGraph.ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Only ever moves toward "hidden" — a card whose own tap already
    // dismissed its sticker has nothing to undo here. No animation for this
    // path (unlike a real tap on *this* card, see addRecommendedToWatchlist
    // below) — there's no "just did it" moment to communicate for a card
    // the viewer never actually touched, it should just already read as
    // unavailable from the moment this becomes true.
    if (isInWatchlist && !addedToWatchlist) {
      setAddedToWatchlist(true);
      watchlistOpacity.setValue(0);
      watchlistBounce.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInWatchlist]);

  useEffect(() => {
    return () => {
      if (pendingTapRef.current) clearTimeout(pendingTapRef.current);
      if (watchlistDismissTimeoutRef.current) clearTimeout(watchlistDismissTimeoutRef.current);
    };
  }, []);

  const playBurst = () => {
    setShowBurst(true);
    burstScale.setValue(0.3);
    burstOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 160 }),
      Animated.delay(300),
      Animated.timing(burstOpacity, { toValue: 0, duration: 250, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setShowBurst(false));
  };

  const handleContentPress = (originalOnPress?: () => void) => () => {
    const now = Date.now();
    if (now - lastTapAtRef.current < DOUBLE_TAP_WINDOW_MS) {
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
        pendingTapRef.current = null;
      }
      lastTapAtRef.current = 0;
      if (!share.liked) handleLikePress();
      playBurst();
    } else {
      // A stale timer from an earlier isolated tap (one that never got a
      // follow-up within its own window) could otherwise still be sitting
      // here — clearing it first means at most one pending navigation is
      // ever in flight, not two firing back to back.
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
        pendingTapRef.current = null;
      }
      lastTapAtRef.current = now;
      if (originalOnPress) {
        pendingTapRef.current = setTimeout(() => {
          pendingTapRef.current = null;
          originalOnPress();
        }, DOUBLE_TAP_WINDOW_MS);
      }
    }
  };

  const burstOverlayEl = showBurst && (
    <View style={styles.burstOverlay} pointerEvents="none">
      <Animated.View style={{ opacity: burstOpacity, transform: [{ scale: burstScale }] }}>
        <Ionicons name="heart" size={90} color="#fff" style={styles.heartShadow} />
      </Animated.View>
    </View>
  );

  useEffect(() => {
    registerShareView(share._id).catch(() => {});
    // Fire once per mount — the backend dedupes by user, so a re-mount
    // while scrolling is a harmless no-op, not a double count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share._id]);

  // ── Poll voting ("poll" type only) ──────────────────────────────────
  // Local optimistic state (mirrors the `share` prop's own shape) rather
  // than lifting into SharesFeedSection's own list state — the parent only
  // ever tracks like/liked for its optimistic-toggle rollback, and a poll
  // vote has no reason to re-sort or otherwise affect the feed list itself.
  const [pollOptions, setPollOptions] = useState<PollOption[]>(share.pollData?.options ?? []);
  const [userVoteIndex, setUserVoteIndex] = useState<number | null>(share.userVoteIndex ?? null);
  const pollTotalVotes = pollOptions.reduce((sum, o) => sum + o.voteCount, 0);

  // No LayoutAnimation here (an earlier round added it, purely for a smooth
  // button-row -> result-bars transition) — real bug reported live: on a
  // poll's first-ever vote specifically, the view would visually freeze in
  // a half-pressed/darkened state and never actually show the result until
  // the whole app was reloaded, consistently, on every single poll. That
  // exact "state updates in JS but the native view never repaints until
  // something else forces a layout" symptom matches a known category of
  // LayoutAnimation bugs on React Native (particularly combined with a
  // percentage-based width changing on the very next render, which is
  // exactly what this transition does). Removed outright rather than
  // chasing a workaround — the state update itself (setPollOptions/
  // setUserVoteIndex) is what actually matters; the view just snaps to the
  // new layout now instead of easing into it, which is a fully acceptable
  // trade for "the vote result reliably appears."
  const handleVote = (optionIndex: number) => {
    if (userVoteIndex === optionIndex) return;
    const previousOptions = pollOptions;
    const previousVoteIndex = userVoteIndex;
    setPollOptions((opts) =>
      opts.map((o, i) => {
        if (i === optionIndex) return { ...o, voteCount: o.voteCount + 1 };
        if (i === previousVoteIndex) return { ...o, voteCount: Math.max(0, o.voteCount - 1) };
        return o;
      })
    );
    setUserVoteIndex(optionIndex);
    voteOnPoll(share._id, optionIndex)
      .then((res) => {
        setPollOptions(res.options);
        setUserVoteIndex(res.userVoteIndex);
      })
      .catch(() => {
        setPollOptions(previousOptions);
        setUserVoteIndex(previousVoteIndex);
        showToast(t("Something went wrong. Please try again."));
      });
  };

  const meta = typeMeta(share.type, colors, t, share.officialCategory);
  const posterUri = share.contentData?.posterUrl ? `${POSTER_BASE}${share.contentData.posterUrl}` : null;

  // "official" type only — turns 0+ words in officialText into tappable
  // in-app links (tips carry one absolute route; trivia's title-
  // referencing templates carry one or two content-detail links instead,
  // resolved against this card's own `basePath` the same way goToContent
  // already does for the single top-level contentId/contentType fields).
  // Most official posts have no link at all and this just falls through to
  // the plain string.
  const officialTextEl = share.officialLinks?.length
    ? renderTextWithLinks(
        share.officialText || "",
        share.officialLinks.map((link) => ({
          word: link.word,
          onPress: () =>
            router.push((link.href || (link.contentId && link.contentType ? `${basePath}/content/${link.contentType}/${link.contentId}` : "")) as any),
        })),
        styles.captionLink
      )
    : share.officialText;
  // All 6 official text categories now get the bold+italic treatment,
  // each added on direct ask as that category was reviewed in turn.
  const officialTextIsEmphasized =
    share.officialCategory === "trivia" ||
    share.officialCategory === "tip" ||
    share.officialCategory === "highlight" ||
    share.officialCategory === "on_this_day" ||
    share.officialCategory === "stats" ||
    share.officialCategory === "announcement";

  // Premium's inner content box gets the gold border+glow, Pro doesn't —
  // the user's own explicit split after confirming Premium outranks Pro.
  // Who-posted-this tier itself is shown two ways now: UserAvatar's own
  // TierAvatarFrame ring, and this inline mark next to the username — same
  // diamond shape for both tiers (only the ring's own per-tier color
  // changes), a second, more legible copy of the same signal since the
  // ring itself is a thin 1.5px border easy to miss while scrolling.
  const isPremium = share.user.accountTier === "premium";
  // Pro/Premium only (not dev, even though tierFrames.ts defines a color
  // for it too) — matches the original tier-badge's own scope from before
  // this whole arc, the user's own ask was specifically about these two.
  const tierLabel = share.user.accountTier === "plus" || share.user.accountTier === "premium" ? share.user.accountTier : null;
  const tierMark = tierLabel ? <Ionicons name="diamond" size={12} color={TIER_FRAME_STYLES[tierLabel]?.glowColor} /> : null;
  // The official Cinephix account's own verified badge — same slot pattern
  // as tierMark right beside it, shown whenever the poster is the one
  // reserved official account (officialContentService.js), independent of
  // its own accountTier. colors.primary (not the earlier colors.info) so it
  // reads as "on-brand" and stays coordinated with the official avatar's
  // own gradient (which also runs into colors.primary) across every theme,
  // rather than a fixed "info blue" that could clash with some palettes.
  const officialBadge = share.user.isOfficial ? <Ionicons name="checkmark-circle" size={13} color={colors.primary} /> : null;
  // The official account's own username always renders in caps ("CINEPHIX"),
  // independent of how it's actually stored/typed elsewhere (login, search,
  // @mentions, ...) — purely a display convention for this one reserved
  // account, not a case-normalization of usernames in general.
  const displayUsername = share.user.isOfficial ? share.user.username.toUpperCase() : share.user.username;
  // Plus/Premium posters get the same metallic gradient-filled name Discovery's
  // Popular Lists/Popular Reviews already use (TierGradientText) instead of a
  // flat tier-colored one — direct ask. Free/dev and the official account (never
  // plus/premium) fall back to the plain Text below unchanged, official's own
  // italic styling included.
  const usernameEl = tierLabel ? (
    <TierGradientText text={displayUsername} tier={tierLabel} fontSize={14} gradientId={`share-username-${share._id}`} color={colors.baseContent} bold />
  ) : (
    <Text style={[styles.username, share.user.isOfficial && styles.usernameOfficial]} numberOfLines={1}>
      {displayUsername}
    </Text>
  );

  // Hollow rounded-rect stroke overlaid on the inner box (shareBox or
  // analysisBox), last in paint order so it sits above the box's own
  // content without a pixel-measured width (percentage Rect dimensions
  // resolve against the Svg's own RN-layout size — the box's, since this
  // is rendered as a child of it). pointerEvents="none" so it never blocks
  // taps to the box itself.
  const premiumBorder = isPremium ? (
    <Svg style={styles.premiumBorderSvg} pointerEvents="none">
      <Defs>
        <LinearGradient id="premiumCardGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={TIER_GOLD_HIGHLIGHT} />
          <Stop offset="1" stopColor={TIER_GOLD} />
        </LinearGradient>
      </Defs>
      {/* x/width both in % (not x="1" mixed with width="98%") so the inset
          is symmetric on every side — the old mix of an absolute-pixel x
          with a percentage width left the left edge inset by exactly 1px
          but the right edge by ~2% of the box's own width, which is
          several pixels wider on anything but a very narrow box, visibly
          uncovering the right edge. A second, wider low-opacity stroke was
          tried here as a "glow" underneath this line — removed again, an
          SVG stroke has a genuinely hard edge (no blur), which read as
          rough/amateurish rather than soft, and this app has no reliable
          cross-platform way to get a real blurred glow here. Just the
          crisp line now — no glow attempt at all. */}
      <Rect x="1%" y="1%" width="98%" height="98%" rx={INNER_BOX_RADIUS - 1} stroke="url(#premiumCardGradient)" strokeWidth={1.5} fill="none" />
    </Svg>
  ) : null;

  // Same hollow rounded-rect stroke technique as premiumBorder above, but
  // theme-matched instead of gold — for the official Cinephix account's own
  // post boxes only (officialBox/pollBox, direct ask), reusing the same
  // neutral->primary pair the official avatar's own gradient already uses
  // rather than a fixed color, so it stays coordinated with that identity
  // across every theme. Unique gradient id per share (same reasoning as
  // every other per-card SVG gradient in this file).
  const officialBorder = share.user.isOfficial ? (
    <Svg style={styles.premiumBorderSvg} pointerEvents="none">
      <Defs>
        <LinearGradient id={`official-card-gradient-${share._id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.neutral} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Rect
        x="1%"
        y="1%"
        width="98%"
        height="98%"
        rx={INNER_BOX_RADIUS - 1}
        stroke={`url(#official-card-gradient-${share._id})`}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  ) : null;

  // One combined message now instead of a separate teaser+promo pair — the
  // sharer's own custom note when set, otherwise the existing full
  // "have you watched it yet? so-and-so recommends it" sentence (already
  // translated in all 12 locales, previously unused once the teaser/promo
  // split shipped).
  const recommendMessage = () => {
    if (share.note) return share.note;
    const key =
      share.contentType === "series"
        ? "Have you watched this series yet? {{user}} recommends it — don't miss it, add it to your watchlist!"
        : "Have you watched this movie yet? {{user}} recommends it — don't miss it, add it to your watchlist!";
    return t(key, { user: share.user.username });
  };

  const goToWatchlist = () => router.push("/to-watch" as any);

  // Standalone CTA button *alongside* the inline "watchlist" link above
  // (not a replacement for it) — the two serve different purposes: the
  // link browses to the Watchlist tab itself, this button one-tap-adds
  // *this* specific content without leaving the feed. A multi-word phrase
  // like "add it to your watchlist" wasn't linked as a whole (only the
  // single word "watchlist" is) because a multi-word phrase isn't
  // guaranteed to stay contiguous once translated (word order varies by
  // locale, unlike a single word). Reuses two existing (previously unused
  // anywhere in the app) translation keys already present in every locale
  // — "Add to Watchlist" for the button, "Added to Watchlist" for the
  // confirmation toast — no new keys needed.
  // Optimistic now — reported live as feeling slow, even though the actual
  // request wasn't: the success state (and its toast) used to wait on
  // `await addToToWatchList(...)` resolving before showing anything at all,
  // so the plus sticker just sat there unchanged for the whole round trip.
  // Same optimistic-then-reconcile shape SharesFeedSection.tsx's own like
  // toggle already uses — flip to "added" immediately, fire the request in
  // the background, and roll the visible state back if it actually fails
  // (rare; a real failure now surfaces as a quick success→error toast flip
  // rather than a silent no-op, which is the honest trade-off for not
  // waiting on the network before reacting to the tap).
  const addRecommendedToWatchlist = async () => {
    if (addedToWatchlist || !share.contentId || !share.contentType) return;
    const contentId = share.contentId;
    const contentType = share.contentType;
    setAddedToWatchlist(true);
    watchlistGraph.applyAdd(contentId, contentType);
    // Plain default toast now, not the "success" (tinted+bordered+icon)
    // variant — reported live as not fitting here even though the style
    // itself was liked elsewhere; kept the ToastContext capability for
    // wherever it does fit, just not this specific call site.
    showToast(t("Added to Watchlist"));
    // Let the tap-bounce settle and the colorful plus register for a
    // beat before it disappears — an instant vanish on success reads as
    // a glitch, not a confirmation. The toast already carries the "done"
    // message and addedToWatchlist already blocks repeat taps, so once
    // this plays out there's nothing left for the sticker itself to
    // communicate — shrinking it away declutters the post rather than
    // leaving an inert, unchanging colored shape sitting there.
    watchlistDismissTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(watchlistOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(watchlistBounce, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }, 500);
    try {
      await addToToWatchList(contentId, contentType);
    } catch (e: any) {
      if (watchlistDismissTimeoutRef.current) {
        clearTimeout(watchlistDismissTimeoutRef.current);
        watchlistDismissTimeoutRef.current = null;
      }
      watchlistOpacity.setValue(1);
      watchlistBounce.setValue(1);
      setAddedToWatchlist(false);
      watchlistGraph.applyRemove(contentId, contentType);
      // Surfaces the backend's own message (e.g. "Already in watchlist" —
      // still theoretically reachable in the brief window before this
      // card's own watchlistGraph.ensureLoaded() call resolves) instead of
      // a hardcoded generic string that used to hide what actually
      // happened, same fallback shape useFollowState.ts's own error
      // handling already uses.
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    }
  };

  // The eye icon now always shows, even when there's an avatar stack —
  // avatars alone don't say what they mean (could be read as who liked it,
  // who follows, anything), the icon is what actually says "viewed by".
  // The eye is a small badge overlapping the avatar stack's own corner
  // when there are real viewers to show (same "badge overlapping an
  // avatar" language PeoplePodiumCard's rank badge and tier mark already
  // use elsewhere in this app), rather than a separate leading icon next
  // to it — reads as one integrated cluster instead of two disconnected
  // elements. Falls back to a plain eye-outline icon with nothing to badge
  // onto when there are no real viewers yet.
  const viewRow = (
    <View style={styles.viewRow}>
      {share.topViewers && share.topViewers.length > 0 ? (
        <View style={styles.viewAvatarRow}>
          <StackedAvatars users={share.topViewers} size={18} max={5} />
          <View style={styles.viewEyeAvatar}>
            <Ionicons name="eye" size={11} color="#fff" />
          </View>
        </View>
      ) : (
        <Ionicons name="eye-outline" size={15} color={colors.placeholder} />
      )}
      {share.viewCount > 0 && <Text style={styles.viewCount}>{share.viewCount}</Text>}
    </View>
  );

  // Recommendation-only sibling of the like sticker below, same floating
  // tilted-badge language, sitting just to its left — a bare shape (no
  // circle/pill wrap, per direct ask: "artı şeklini butona sarma"), a
  // thick plus with softened (not fully pill-rounded) corners — rx:2 on
  // an 8-unit-thick bar reads as "squared with soft edges" rather than
  // the previous round's rx:4 capsule ends — drawn as two crossed Rects
  // rather than an Ionicons glyph (Ionicons' "add" isn't adjustable in
  // stroke weight; a hand-drawn shape gives full control over how chunky
  // it reads). Always gradient-filled, not conditional on
  // addedToWatchlist — a direct correction from the previous round's
  // gray→gradient switch (which mirrored the heart's own liked/unliked
  // colors too literally): the user wants this one colorful from the
  // start, not dimmed until tapped. Rotated the opposite way from the
  // heart (+10 vs -12) so the pair reads as fanned out rather than a
  // mirrored twin, and gets its own tap-bounce (fires on every press,
  // independent of addedToWatchlist's own state, purely for the same
  // satisfying "effect" the heart already has). Only rendered from the
  // recommendation return branch below (declared here, alongside
  // likeStickerEl, since both are per-render-instance closures over this
  // card's own state either way).
  const watchlistStickerEl = (
    <Animated.View
      style={[styles.watchlistSticker, { opacity: watchlistOpacity, transform: [{ rotate: "10deg" }, { scale: watchlistBounce }] }]}
    >
      <Pressable onPress={handleWatchlistStickerPress} hitSlop={10} disabled={addedToWatchlist}>
        <View style={styles.watchlistStickerWrap}>
          <Svg width={36} height={36} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id="watchlistPlusGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={WATCHLIST_RING_HIGHLIGHT} />
                <Stop offset="1" stopColor={colors.primary} />
              </LinearGradient>
            </Defs>
            {/* No frame — tried twice (a circular CSS border, then a
                contour-hugging SVG stroke), reverted both times per direct
                ask: the plus stays bare, just the gradient fill. */}
            <Rect x={2} y={8} width={20} height={8} rx={2} fill="url(#watchlistPlusGradient)" />
            <Rect x={8} y={2} width={8} height={20} rx={2} fill="url(#watchlistPlusGradient)" />
          </Svg>
        </View>
      </Pressable>
    </Animated.View>
  );

  // Floating corner sticker, not part of the footer row anymore — one per
  // card (there's always exactly one content box per share.type, so no
  // need to place this per-box).
  const likeStickerEl = (
    <Animated.View style={[styles.likeSticker, { transform: [{ rotate: "-12deg" }, { scale: likeBounce }] }]}>
      <Pressable onPress={handleLikePress} hitSlop={10}>
        <View style={[styles.likeStickerHeartWrap, share.liked && styles.likeStickerGlow]}>
          {/* Gray base heart, always present underneath — the red gradient
              version crossfades in on top of it (below) rather than the
              fill snapping between the two, so "coloring in" actually reads
              as an animation instead of an instant cut. */}
          <Svg width={36} height={36} viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={colors.placeholder}
            />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: likeColorAnim }]}>
            <Svg width={36} height={36} viewBox="0 0 24 24">
              <Defs>
                <LinearGradient id="likeHeartGradient" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={LIKE_RING_HIGHLIGHT} />
                  <Stop offset="1" stopColor={colors.error} />
                </LinearGradient>
              </Defs>
              {/* No frame here either — added to match the watchlist plus
                  sticker, reverted along with it per direct ask; back to
                  just the single filled heart path. */}
              <Path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill="url(#likeHeartGradient)"
              />
            </Svg>
          </Animated.View>
        </View>
        {/* Always rendered (never conditional) so the count row's own
            height is reserved whether or not it has content — a
            conditional Text here made the heart visibly jump position the
            instant likeCount crossed 0, since it's stacked above the count
            in a column and the whole sticker is bottom-anchored. opacity
            hides the "0" without collapsing its layout space. Countered
            +12deg — the outer sticker's own -12deg tilt would otherwise
            carry through to this Text too (transforms apply to the whole
            subtree), which read as messy/hard to read on a number
            specifically, even though the tilt works fine for the heart
            shape itself — the heart stays playful, the count stays level. */}
        <Text style={[styles.likeStickerCount, { opacity: share.likeCount > 0 ? 1 : 0, transform: [{ rotate: "12deg" }] }]}>
          {share.likeCount || "0"}
        </Text>
      </Pressable>
    </Animated.View>
  );

  const typeChipEl = (
    <View style={[styles.typeChip, { backgroundColor: meta.color }]}>
      <Ionicons name={meta.icon} size={10} color="#fff" />
      <Text style={styles.typeChipText}>{meta.label.toUpperCase()}</Text>
    </View>
  );

  if (share.type === "recommendation" && share.contentData) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <UserAvatar userId={share.user._id} username={share.user.username} profilePicUrl={share.user.profile_pic_url} size={38} tier={share.user.accountTier} isOfficial={share.user.isOfficial} />
          <View style={styles.headerTextCol}>
            <View style={styles.usernameRow}>
              {usernameEl}
              {tierMark}
              {officialBadge}
            </View>
            {typeChipEl}
          </View>
          <FollowButton targetUserId={share.user._id} size="small" />
        </View>

        {/* Recommendation posts are deliberately not a single big tap
            target — only the poster (navigates to content) and the
            "Watchlist" word inside the message (navigates to the Watchlist
            tab) actually do anything; everywhere else in the box (title,
            the rest of the message, empty padding) is inert on a single
            tap, per direct ask. `handleContentPress()` called with no
            `originalOnPress` (same as the analysis box below) means a
            single tap here is a no-op, while double-tap-to-like still
            works across the whole box — that gesture wasn't asked to
            change. The poster is its own nested Pressable so its tap
            resolves before it ever reaches this box's own handler (same
            "inner tap wins" pattern as the review box's excerpt Pressable
            below). */}
        <Pressable style={styles.shareBox} onPress={handleContentPress()}>
          <Pressable style={styles.sharePoster} onPress={goToContent}>
            {posterUri && <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          </Pressable>
          <View style={styles.shareTextCol}>
            <Text style={styles.shareTitle} numberOfLines={2}>
              {share.contentData.title}
            </Text>
            <Text style={styles.shareMessage}>
              {renderRecommendMessage(recommendMessage(), t("Watchlist"), styles.captionLink, goToWatchlist)}
            </Text>
          </View>
          {premiumBorder}
          {burstOverlayEl}
        </Pressable>

        <View style={styles.footer}>{viewRow}</View>
        {watchlistStickerEl}
        {likeStickerEl}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <UserAvatar userId={share.user._id} username={share.user.username} profilePicUrl={share.user.profile_pic_url} size={38} tier={share.user.accountTier} isOfficial={share.user.isOfficial} />
        <View style={styles.headerTextCol}>
          <View style={styles.usernameRow}>
            {usernameEl}
            {tierMark}
            {officialBadge}
          </View>
          {typeChipEl}
        </View>
        <FollowButton targetUserId={share.user._id} size="small" />
      </View>

      {share.type === "analysis" && share.analysisData && (
        <Pressable style={styles.analysisBox} onPress={handleContentPress()}>
          {share.analysisData.nickname ? <Text style={styles.analysisNickname}>{share.analysisData.nickname}</Text> : null}
          {share.analysisData.personalitySummary ? (
            <Text style={styles.analysisSummary} numberOfLines={5}>
              {share.analysisData.personalitySummary}
            </Text>
          ) : null}
          {premiumBorder}
          {burstOverlayEl}
        </Pressable>
      )}

      {share.type === "list" && share.listData && (
        <GHPressable style={styles.listBox} onPress={handleContentPress(goToList)}>
          {/* The "shared a list" info line moved one step further out — no
              longer even inside this box, now shared with review's own
              equal line just above the header/box boundary (see there for
              why). Just the title leads here now, description (if any)
              still follows as its own separate line, same as before. */}
          <Text style={styles.shareTitle} numberOfLines={1}>
            {share.listData.name}
          </Text>
          {share.listData.description ? (
            <Text style={[styles.shareMessage, styles.shareMessageItalic]} numberOfLines={1}>
              {share.listData.description}
            </Text>
          ) : null}
          {share.listData.previewItems.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmStripContainer}>
              {share.listData.previewItems.map((item) => (
                <View key={`${item.itemType}-${item.itemId}`} style={styles.filmStripPoster}>
                  {item.poster_path ? (
                    <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.filmStripFallback]}>
                      <Text style={styles.filmStripFallbackText} numberOfLines={3}>
                        {item.title}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
          <Text style={styles.listCount}>{t("item_count", { count: share.listData.itemCount })}</Text>
          {premiumBorder}
          {burstOverlayEl}
        </GHPressable>
      )}

      {share.type === "review" && share.contentData && (
        <Pressable style={styles.shareBox} onPress={handleContentPress(goToContent)}>
          <View style={styles.sharePoster}>{posterUri && <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}</View>
          <View style={styles.shareTextCol}>
            <Text style={styles.shareTitle} numberOfLines={2}>
              {share.contentData.title}
            </Text>
            {share.reviewRating != null && (
              <View style={styles.shareRatingRow}>
                <StarRatingDisplay value={share.reviewRating} size={13} />
              </View>
            )}
            {/* The "shared a review" fallback that used to live here moved
                out to the shared info line above the box (see there) — this
                box's own text slot is now purely the review excerpt itself,
                or nothing at all when there isn't one (matching list's own
                "no description = no extra line" behavior). Capped at
                REVIEW_COLLAPSED_LINES so the post's own height stays fixed
                regardless of review length; a nested Pressable (proven
                pattern for "inner tap wins" over an ancestor Pressable,
                same as ListRailCard/ReviewSwipeCard's own details button)
                opens the full text in a Modal instead of triggering the
                outer box's own navigate-to-content tap. */}
            {share.reviewText ? (
              <Pressable onPress={() => setFullReviewVisible(true)}>
                <Text style={[styles.shareMessage, styles.shareMessageItalic]} numberOfLines={REVIEW_COLLAPSED_LINES}>{`"${share.reviewText}"`}</Text>
              </Pressable>
            ) : null}
          </View>
          {premiumBorder}
          {burstOverlayEl}
        </Pressable>
      )}

      {share.type === "official" && share.officialText && (
        <Pressable
          style={styles.officialBox}
          onPress={handleContentPress(share.contentId && share.contentType ? goToContent : undefined)}
        >
          {share.contentData ? (
            // No separate title heading here (there used to be one) — every
            // official post that reaches this branch already names the
            // title inside its own sentence (e.g. "...right now:
            // Oppenheimer!"), so a bold "Oppenheimer" heading right above
            // that same sentence just repeated it. Poster + sentence only.
            <View style={styles.officialContentRow}>
              <Pressable style={styles.sharePoster} onPress={goToContent}>
                {posterUri && <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
              </Pressable>
              <View style={styles.shareTextCol}>
                <Text style={[styles.officialText, officialTextIsEmphasized && styles.officialTextEmphasis]}>{officialTextEl}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.officialText, officialTextIsEmphasized && styles.officialTextEmphasis]}>{officialTextEl}</Text>
          )}
          {premiumBorder}
          {officialBorder}
          {burstOverlayEl}
        </Pressable>
      )}

      {share.type === "poll" && share.pollData && (
        <View style={styles.pollBox}>
          {officialBorder}
          <Text style={styles.pollQuestion}>{share.pollData.question}</Text>
          <View style={styles.pollOptionsCol}>
            {pollOptions.map((option, i) => {
              if (userVoteIndex == null) {
                return (
                  // key includes "-btn" so the button->result-bar switch below
                  // mounts a genuinely NEW Pressable instead of restyling the
                  // one that's still mid-touch from the tap that just caused
                  // this switch — reusing the same native instance is what
                  // let Android's press/ripple state get stuck rendering
                  // "dark" after the very first vote on a poll (only a full
                  // reload, which remounts everything, ever cleared it).
                  <Pressable key={`${i}-btn`} style={styles.pollOptionButton} onPress={() => handleVote(i)}>
                    <Text style={styles.pollOptionButtonText}>{option.text}</Text>
                  </Pressable>
                );
              }
              const percent = pollTotalVotes > 0 ? Math.round((option.voteCount / pollTotalVotes) * 100) : 0;
              const isChosen = userVoteIndex === i;
              return (
                <Pressable key={`${i}-result`} style={styles.pollResultTrack} onPress={() => handleVote(i)}>
                  <View style={[styles.pollResultFill, { width: `${percent}%` }]} />
                  <View style={styles.pollResultRow}>
                    <Text style={[styles.pollResultLabel, isChosen && styles.pollResultLabelChosen]} numberOfLines={1}>
                      {isChosen ? `✓ ${option.text}` : option.text}
                    </Text>
                    <View style={styles.pollResultTrailing}>
                      {option.topVoters && option.topVoters.length > 0 && <StackedAvatars users={option.topVoters} size={16} max={5} />}
                      <Text style={styles.pollResultPercent}>{percent}%</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.pollVoteCountLine}>{t("vote_count", { count: pollTotalVotes })}</Text>
        </View>
      )}

      <View style={styles.footer}>{viewRow}</View>
      {likeStickerEl}

      {share.type === "review" && share.contentData && share.reviewText && (
        <Modal transparent visible={fullReviewVisible} animationType="fade" onRequestClose={() => setFullReviewVisible(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalCloseZone} onPress={() => setFullReviewVisible(false)} />
            <View style={styles.modalCard} pointerEvents="box-none">
              <Pressable onPress={() => setFullReviewVisible(false)}>
                <View style={styles.modalPosterSection}>
                  {posterUri ? <Image source={{ uri: posterUri }} style={styles.modalPoster} /> : <View style={styles.modalPoster} />}
                  <Text style={styles.modalContentTitle} numberOfLines={2}>
                    {share.contentData.title}
                  </Text>
                </View>
                <View style={styles.modalReviewerRow}>
                  <UserAvatar userId={share.user._id} username={share.user.username} profilePicUrl={share.user.profile_pic_url} size={26} disabled isOfficial={share.user.isOfficial} />
                  <Text style={styles.modalUsername} numberOfLines={1}>
                    {share.user.username}
                  </Text>
                  {share.reviewRating != null && (
                    <View style={styles.modalRatingRow}>
                      <StarRatingDisplay value={share.reviewRating} size={13} />
                    </View>
                  )}
                </View>
              </Pressable>
              <RNScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalQuote}>{`"${share.reviewText}"`}</Text>
              </RNScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// React.memo — SharesFeedSection.tsx's FlatList renders one of these per
// visible post; without this, liking one post (or any unrelated re-render
// of an ancestor, e.g. the header's Paylaşımlar/Keşfet pill tap re-rendering
// home/index.tsx) re-rendered *every* currently-mounted card, not just the
// one that actually changed. Only pays off because every prop is now
// actually stable across such re-renders: `share` keeps the same object
// reference for every row `.map()` passes through untouched (only the
// toggled item gets a new one), and `onToggleLike` is a `useCallback([])` in
// the parent rather than a fresh per-row arrow function — see both call
// sites' own comments.
export default memo(ShareCard);
