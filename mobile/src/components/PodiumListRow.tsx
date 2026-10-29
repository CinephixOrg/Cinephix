import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { AccountTier } from "../types";

const AVATAR_SIZE = 36;

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
  rank: number;
  user: { id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  metric: PeopleMetric;
  // The viewer's own row, wherever it falls — ranks 4-15 in the normal
  // flow, or the separately pinned row past PEOPLE_LEADERBOARD_SIZE.
  // Direct ask ("listesel kısımda senin yerin kısmını da böylece
  // gösterebiliriz") — a classic leaderboard-list highlight, not a
  // separate card.
  highlight?: boolean;
}

// One row below the top-3 steps on the People Podium's own dedicated page
// — ranks 4-15, plus the viewer's own pinned row when they fall outside
// that range. A plain numbered rank badge (not a medal color — medals
// stay exclusive to the real top 3 above), the same small-avatar +
// username + metric-icon shape used everywhere else this app shows a
// person in a list.
export default function PodiumListRow({ rank, user, metric, highlight }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const tierLabel = user.accountTier === "plus" || user.accountTier === "premium" ? user.accountTier : null;
  const tierMarkColor = tierLabel ? TIER_FRAME_STYLES[tierLabel]?.glowColor : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: highlight ? colors.primary + "14" : "transparent",
        },
        rankBadge: {
          width: 26,
          alignItems: "center",
        },
        rankText: { fontFamily: fonts.bold, fontSize: 13, color: highlight ? colors.primary : colors.placeholder },
        body: { flex: 1, minWidth: 0 },
        usernameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
        username: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, flexShrink: 1 },
        metricRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        metricText: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.placeholder },
      }),
    [colors, highlight]
  );

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/user/${user.id}` as any)}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <UserAvatar userId={user.id} username={user.username} profilePicUrl={user.profile_pic_url} size={AVATAR_SIZE} disabled />
      <View style={styles.body}>
        <View style={styles.usernameRow}>
          {tierLabel && <Ionicons name="diamond" size={9} color={tierMarkColor} />}
          <Text style={styles.username} numberOfLines={1}>
            {user.username}
          </Text>
        </View>
      </View>
      <View style={styles.metricRow}>
        <Ionicons name={METRIC_ICON[metric.kind]} size={13} color={colors.warning} />
        <Text style={styles.metricText}>{metric.count}</Text>
      </View>
    </Pressable>
  );
}
