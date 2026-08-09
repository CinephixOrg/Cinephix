import { View, Text, Image, StyleSheet } from "react-native";
import type { MatchResult } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  matches: MatchResult[];
}

const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd — 1st rendered elevated/center

// Plain percentage text here (not MatchPercentageRing) — mirrors web, where
// the ring is MatchCard-only and the leaderboard just shows "N%".
export default function MatchLeaderboard({ matches }: Props) {
  const top3 = matches.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <View style={styles.row}>
      {PODIUM_ORDER.map((i) => {
        const match = top3[i];
        if (!match) return <View key={i} style={styles.slot} />;
        const rank = i + 1;
        const isFirst = rank === 1;
        return (
          <View key={match.user._id} style={[styles.slot, isFirst && styles.slotFirst]}>
            {isFirst && <Text style={styles.crown}>👑</Text>}
            {match.user.profile_pic_url ? (
              <Image
                source={{ uri: match.user.profile_pic_url }}
                style={[styles.avatar, isFirst && styles.avatarFirst, styles.avatarRing]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  isFirst && styles.avatarFirst,
                  styles.avatarRing,
                  styles.avatarFallback,
                ]}
              >
                <Text style={styles.avatarFallbackText}>
                  {match.user.username.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.username} numberOfLines={1}>
              {match.user.username}
            </Text>
            {match.user.bio ? (
              <Text style={styles.bio} numberOfLines={1}>
                {match.user.bio}
              </Text>
            ) : null}
            <Text style={styles.percentage}>{match.matchPercentage}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, marginBottom: 20 },
  slot: { flex: 1, alignItems: "center" },
  slotFirst: { marginBottom: 12 },
  crown: { fontSize: 20, marginBottom: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.base300 },
  avatarFirst: { width: 72, height: 72, borderRadius: 36 },
  avatarRing: { borderWidth: 2, borderColor: colors.primary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  username: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.baseContent,
    marginTop: 8,
    maxWidth: 90,
  },
  bio: { fontSize: 11, color: colors.placeholder, maxWidth: 90, marginTop: 1 },
  percentage: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginTop: 4 },
});
