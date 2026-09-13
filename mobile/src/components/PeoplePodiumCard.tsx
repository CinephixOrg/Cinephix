import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import UserAvatar from "./UserAvatar";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import type { AccountTier } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Same gold/silver/bronze medal colors and gradient-stroke-+-glow frame
// technique as LeaderboardCard.tsx (Discover's content podium) — kept as
// a second, independent copy of the constants rather than a shared import,
// matching this app's own established "don't abstract a small repeated
// pattern" convention (the gradient-frame SVG itself is already
// re-implemented locally at every one of its use sites this session).
const MEDAL_COLORS = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" } as const;
const MEDAL_HIGHLIGHT_COLORS = { 1: "#FFF3C4", 2: "#F2F3F5", 3: "#F0C08A" } as const;
const AVATAR_SIZE = { 1: 88, 2: 68, 3: 68 } as const;
const STROKE_WIDTH = 3;
// An SVG stroke straddles its own path — half its width renders *outside*
// the path's nominal bounds. The old percentage-based inset (x="1.5"/
// width="97%") left less margin than that overflow needed, which read as
// a real, reported sliver of clipping on the avatar's own right/bottom
// edge. Same fix as LeaderboardCard.tsx's/PodiumSkeletonSlot.tsx's own
// identical bug: the Svg canvas is now genuinely larger than the avatar
// (STROKE_MARGIN px extra on every side), and the Rect is drawn at fixed
// pixel coordinates, not percentages, so the stroke's outer edge always
// lands inside that larger canvas by construction.
const STROKE_MARGIN = 4;
// This card's own rank-medal ring (MEDAL_COLORS above) already occupies
// the avatar's frame, so Plus/Premium can't also get UserAvatar's
// TierAvatarFrame ring here without stacking two competing rings on a
// 68-88px circle — kept as this inline diamond mark instead, scoped to
// this card only (ShareCard.tsx's own posts switched to the ring — see its
// own doc comment — since a post's avatar has no competing ring to fight).
// Colored per-tier from the same TIER_FRAME_STYLES source of truth as
// everywhere else (gold for Premium, silver for Plus), not a flat gold —
// this used to hardcode gold for both tiers, which read as Plus users
// wearing a Premium-colored mark.

type PeopleMetric =
  | { kind: "followed"; count: number }
  | { kind: "watched"; count: number }
  | { kind: "reviewed"; count: number }
  | { kind: "liked"; count: number }
  | { kind: "recommended"; count: number }
  | { kind: "badges"; count: number };

interface Props {
  rank: 1 | 2 | 3;
  user: { id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  metric: PeopleMetric;
  // Free-tier *viewer* gate (unrelated to the podium user's own tier above)
  // — Free sees every podium profile blurred+locked, tapping routes to the
  // subscription page instead of that person's profile. Same technique as
  // Sync's own MatchAvatarRing/MatchCloudBubble: UserAvatar's `blurRadius`
  // bakes a real blur into the photo itself, plus a small lock badge on
  // top — name/rank/metric stay fully visible either way, same as there
  // ("still the actual tease").
  locked?: boolean;
}

// Medya/Shares' own podium card — the avatar-based sibling of
// LeaderboardCard.tsx. Same rank sizing/medal-gradient-frame/platform-line
// shape, just a circular avatar frame instead of a rectangular poster
// frame, and a person to tap through to instead of a piece of content.
export default function PeoplePodiumCard({ rank, user, metric, locked }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const medalColor = MEDAL_COLORS[rank];
  const highlightColor = MEDAL_HIGHLIGHT_COLORS[rank];
  const avatarSize = AVATAR_SIZE[rank];
  const isFirst = rank === 1;
  const gradientId = `peoplePodiumGradient-${rank}`;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { alignItems: "center", width: avatarSize },
        avatarWrap: isFirst
          ? {
              position: "relative",
              shadowColor: MEDAL_COLORS[1],
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            }
          : { position: "relative" },
        frameSvg: { position: "absolute", left: -STROKE_MARGIN, right: -STROKE_MARGIN, top: -STROKE_MARGIN, bottom: -STROKE_MARGIN, overflow: "visible" },
        // Centered on the avatar's own top edge — half the badge sits
        // above it, half overlaps the circle — rather than the top-left
        // corner placement LeaderboardCard.tsx uses for its rectangular
        // posters (a corner reads fine on a rectangle, but looks off-axis
        // on a circular frame).
        rankBadge: {
          position: "absolute",
          top: -11,
          left: "50%",
          marginLeft: -11,
          minWidth: 22,
          height: 22,
          paddingHorizontal: 5,
          borderRadius: 11,
          backgroundColor: medalColor,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base100,
        },
        rankBadgeText: { color: "#3d2b00", fontSize: 11, fontFamily: fonts.bold },
        // Centered on the (blurred) avatar itself, same small circular
        // treatment as Sync's own MatchCloudBubble.tsx lockBadge.
        lockBadge: {
          position: "absolute",
          top: avatarSize / 2 - 14,
          left: avatarSize / 2 - 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base100,
          borderRadius: 999,
          padding: 6,
        },
        platformLine: { width: avatarSize, height: 5, borderRadius: 3, backgroundColor: medalColor, marginTop: 8 },
        // Inline prefix on the username line instead of a badge on the
        // avatar itself (moved per explicit feedback) — row is capped to
        // the card's own width so long usernames still truncate correctly
        // with the icon in place, not pushed out.
        usernameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 6, width: avatarSize },
        username: { fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent, flexShrink: 1 },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
        metricText: { fontSize: 11, fontFamily: fonts.bold, color: colors.placeholder },
      }),
    [colors, medalColor, avatarSize, isFirst]
  );

  const tierLabel = user.accountTier === "plus" || user.accountTier === "premium" ? user.accountTier : null;
  const tierMarkColor = tierLabel ? TIER_FRAME_STYLES[tierLabel]?.glowColor : undefined;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push((locked ? "/match/subscription" : `/user/${user.id}`) as any)}
    >
      <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
        <UserAvatar
          userId={user.id}
          username={user.username}
          profilePicUrl={user.profile_pic_url}
          size={avatarSize}
          disabled
          blurRadius={locked ? Math.max(8, avatarSize * 0.18) : undefined}
        />
        <Svg style={styles.frameSvg} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={highlightColor} />
              <Stop offset="1" stopColor={medalColor} />
            </LinearGradient>
          </Defs>
          <Rect
            x={STROKE_MARGIN}
            y={STROKE_MARGIN}
            width={avatarSize}
            height={avatarSize}
            rx={avatarSize / 2}
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
        </Svg>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank}</Text>
        </View>
        {locked && (
          <View style={styles.lockBadge} pointerEvents="none">
            <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
          </View>
        )}
      </View>

      <View style={styles.platformLine} />

      <View style={styles.usernameRow}>
        {tierLabel && <Ionicons name="diamond" size={9} color={tierMarkColor} />}
        <Text style={styles.username} numberOfLines={1}>
          {user.username}
        </Text>
      </View>

      {metric.kind === "followed" && (
        <View style={styles.metricRow}>
          <Ionicons name="people-outline" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
      {metric.kind === "watched" && (
        <View style={styles.metricRow}>
          <Ionicons name="eye-outline" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
      {metric.kind === "reviewed" && (
        <View style={styles.metricRow}>
          <Ionicons name="pencil" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
      {metric.kind === "liked" && (
        <View style={styles.metricRow}>
          <Ionicons name="heart" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
      {metric.kind === "recommended" && (
        <View style={styles.metricRow}>
          <Ionicons name="gift" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
      {metric.kind === "badges" && (
        <View style={styles.metricRow}>
          <Ionicons name="ribbon" size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>
      )}
    </Pressable>
  );
}
