import { useEffect, useMemo, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { AccountTier } from "../types";

// Same gold/silver/bronze medal colors as PeoplePodiumCard.tsx — kept as
// its own local copy rather than shared/imported, matching this app's own
// established convention for this exact small constant (already
// independently copied in PeoplePodiumCard.tsx/PodiumSkeletonSlot.tsx/
// LeaderboardCard.tsx). Only used for the step fill now — the gradient-
// stroke avatar frame and the circular 1/2/3 badge above it were both
// removed per direct ask ("daha sade ve profesyonel bir görüntü için").
const MEDAL_COLORS = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" } as const;
const AVATAR_SIZE = { 1: 88, 2: 68, 3: 68 } as const;
// The actual stepped-platform heights the reference image's own podium
// has — rank 1 standing visibly taller than 2/3, not just a thin colored
// line under every avatar the same way (the old PeoplePodiumCard look).
// Scaled up from an earlier, shorter version (direct ask — the rank-3
// step was too short to comfortably hold its own embedded number) by the
// exact same factor (×15/11) on all three, so the proportion between them
// is unchanged.
const STEP_HEIGHT = { 1: 76, 2: 46, 3: 30 } as const;
const ENTRANCE_MS = 480;

type PeopleMetric =
  | { kind: "followed"; count: number }
  | { kind: "watched"; count: number }
  | { kind: "reviewed"; count: number }
  | { kind: "liked"; count: number }
  | { kind: "recommended"; count: number }
  | { kind: "badges"; count: number }
  | { kind: "puzzle"; count: number };

const METRIC_ICON: Record<PeopleMetric["kind"], keyof typeof Ionicons.glyphMap> = {
  followed: "people-outline",
  watched: "eye-outline",
  reviewed: "pencil",
  liked: "heart",
  recommended: "gift",
  badges: "ribbon",
  puzzle: "flame",
};

interface Props {
  rank: 1 | 2 | 3;
  user: { id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  metric: PeopleMetric;
  locked?: boolean;
}

// The redesigned top-3 "steps" visual for the People Podium's own
// dedicated page — direct ask, reusing the reference screenshot's own
// raised-platform layout. A deliberate, separate copy from
// PeoplePodiumCard.tsx (not a shared edit) so CommunityRailCard.tsx's own
// unrelated use of that card stays exactly as it was — same "don't share
// a small repeated pattern across unrelated call sites" convention this
// app already follows for the medal-color constants themselves.
export default function PodiumStepCard({ rank, user, metric, locked }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const medalColor = MEDAL_COLORS[rank];
  const avatarSize = AVATAR_SIZE[rank];
  const isFirst = rank === 1;

  // Entrance animation, direct ask ("basamaklar 0'dan mevcut yüksekliğine
  // doğru çıkıyor smooth ve fade bi şekilde") — runs once per mount, which
  // naturally covers both the leaderboard's first load AND every category
  // switch (top3.map keys off each entry's own user id, so a different
  // category's cards are always a fresh mount, never a reused instance).
  // Two separate Animated.Values since height isn't native-driver-eligible
  // (a layout property) but opacity is — run in the same Animated.parallel
  // regardless, each with its own correct useNativeDriver setting.
  const growAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(growAnim, { toValue: 1, duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(fadeAnim, { toValue: 1, duration: ENTRANCE_MS, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animatedStepHeight = growAnim.interpolate({ inputRange: [0, 1], outputRange: [0, STEP_HEIGHT[rank]] });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { alignItems: "center", width: Math.max(avatarSize, 80) },
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
        usernameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 8, width: Math.max(avatarSize, 80) },
        username: { fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent, flexShrink: 1 },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
        metricText: { fontSize: 11, fontFamily: fonts.bold, color: colors.placeholder },
        // The actual raised step — direct ask's own "basamaklı gösterim"
        // (stepped display). Rounded only on top so it reads as a platform
        // the avatar stands on, not a floating pill. The rank number now
        // lives embedded in its own center (direct ask, replacing the old
        // circular badge above the avatar), colored with the page's own
        // background tone so it reads as cut into the medal-colored fill.
        // No fixed `height` here — animatedStepHeight drives it instead
        // (the entrance animation above).
        step: {
          width: Math.max(avatarSize, 80),
          overflow: "hidden",
          marginTop: 10,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          backgroundColor: medalColor,
          alignItems: "center",
          justifyContent: "center",
        },
        stepRankText: { fontFamily: fonts.bold, fontSize: 18, color: colors.base100 },
      }),
    [colors, medalColor, avatarSize, isFirst, rank]
  );

  const tierLabel = user.accountTier === "plus" || user.accountTier === "premium" ? user.accountTier : null;
  const tierMarkColor = tierLabel ? TIER_FRAME_STYLES[tierLabel]?.glowColor : undefined;

  return (
    <Pressable style={styles.card} onPress={() => router.push((locked ? "/match/subscription" : `/user/${user.id}`) as any)}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
        <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
          <UserAvatar
            userId={user.id}
            username={user.username}
            profilePicUrl={user.profile_pic_url}
            size={avatarSize}
            disabled
            blurRadius={locked ? Math.max(8, avatarSize * 0.18) : undefined}
          />
          {locked && (
            <View style={styles.lockBadge} pointerEvents="none">
              <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
            </View>
          )}
        </View>

        <View style={styles.usernameRow}>
          {tierLabel && <Ionicons name="diamond" size={9} color={tierMarkColor} />}
          <Text style={styles.username} numberOfLines={1}>
            {user.username}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Ionicons name={METRIC_ICON[metric.kind]} size={12} color={colors.warning} />
          <Text style={styles.metricText}>{metric.count}</Text>
        </View>

        <Animated.View style={[styles.step, { height: animatedStepHeight }]}>
          <Text style={styles.stepRankText}>{rank}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
