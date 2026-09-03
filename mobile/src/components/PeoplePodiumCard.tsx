import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import UserAvatar from "./UserAvatar";
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
// This card's own rank-medal ring (MEDAL_COLORS above) already occupies
// the avatar's frame, so Pro/Premium can't also get UserAvatar's
// TierAvatarFrame ring here without stacking two competing rings on a
// 68-88px circle — kept as this inline gold mark instead, scoped to this
// card only (ShareCard.tsx's own posts switched to the ring — see its own
// doc comment — since a post's avatar has no competing ring to fight).
const TIER_GOLD = "#FFC94A";

type PeopleMetric =
  | { kind: "followed"; count: number }
  | { kind: "watched"; count: number }
  | { kind: "reviewed"; count: number };

interface Props {
  rank: 1 | 2 | 3;
  user: { id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  metric: PeopleMetric;
}

// Medya/Shares' own podium card — the avatar-based sibling of
// LeaderboardCard.tsx. Same rank sizing/medal-gradient-frame/platform-line
// shape, just a circular avatar frame instead of a rectangular poster
// frame, and a person to tap through to instead of a piece of content.
export default function PeoplePodiumCard({ rank, user, metric }: Props) {
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
        frameSvg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
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

  const tierLabel = user.accountTier === "pro" || user.accountTier === "premium" ? user.accountTier : null;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/user/${user.id}` as any)}>
      <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
        <UserAvatar userId={user.id} username={user.username} profilePicUrl={user.profile_pic_url} size={avatarSize} disabled />
        <Svg style={styles.frameSvg} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={highlightColor} />
              <Stop offset="1" stopColor={medalColor} />
            </LinearGradient>
          </Defs>
          <Rect x="1.5" y="1.5" width="97%" height="97%" rx={avatarSize / 2} stroke={`url(#${gradientId})`} strokeWidth={3} fill="none" />
        </Svg>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank}</Text>
        </View>
      </View>

      <View style={styles.platformLine} />

      <View style={styles.usernameRow}>
        {tierLabel && <Ionicons name="diamond" size={9} color={TIER_GOLD} />}
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
    </Pressable>
  );
}
