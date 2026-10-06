import { memo, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import type { GroupLeaderboardEntry } from "../../types";
import { fonts } from "../../theme/typography";

const AVATAR_SIZE = 44;
// Same gold/silver/bronze medal colors every other podium/leaderboard
// surface in this app already uses (PeoplePodiumCard.tsx, LeaderboardCard.tsx)
// — reused here as a rank badge + avatar ring instead of their own
// taller podium shape, per direct ask ("podyum ile aynı olmamalı... daha
// leaderboard tarzı").
const MEDAL_COLORS: Record<number, string> = { 1: "#FFC94A", 2: "#C7CBD1", 3: "#CD7F32" };
const MEDAL_TEXT_COLORS: Record<number, string> = { 1: "#5c4000", 2: "#3a3d42", 3: "#4a2a0f" };

type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors, accent: string) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.base200,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    cardMine: { borderWidth: 1.5, borderColor: accent },
    rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.base300 },
    rankBadgeText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.placeholder },
    avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.base300 },
    info: { flex: 1, minWidth: 0 },
    usernameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    username: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent, flexShrink: 1 },
    youTag: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
    chipsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    chip: { flexDirection: "row", alignItems: "center", gap: 3 },
    chipText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder },
    scorePill: { alignItems: "center", backgroundColor: `${accent}1A`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 48 },
    scoreValue: { fontFamily: fonts.extrabold, fontSize: 16, color: accent },
    scoreLabel: { fontFamily: fonts.bold, fontSize: 9, color: accent, letterSpacing: 0.4, marginTop: -1 },
  });
}

// Replaces the old podium — direct ask ("podyum ile aynı olmamalı,
// internetteki leaderboard tasarımlarını örnek alabilirsin"): a plain
// numbered ranking (Duolingo/Strava-style weekly leaderboard), one row
// per member as its OWN card rather than a shared list with dividers — a
// medal-colored rank badge + avatar ring for the top 3 is the one visual
// flourish, everything else stays a clean, scannable row. The viewer's
// own row gets an accent border so they can find themselves at a glance.
// Shared by Overview's own top-3 slice and the full "See all" page.
function CommunityLeaderboardRows({ entries, limit }: { entries: GroupLeaderboardEntry[]; limit?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const accent = colors.primary;
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

  const visible = limit ? entries.slice(0, limit) : entries;

  return (
    <View>
      {visible.map((entry) => {
        if (!entry.user) return null;
        const medalColor = MEDAL_COLORS[entry.rank];
        const isMine = entry.user._id === user?._id;
        return (
          <View key={entry.user._id} style={[styles.card, isMine && styles.cardMine]}>
            <View style={[styles.rankBadge, medalColor && { backgroundColor: medalColor }]}>
              <Text style={[styles.rankBadgeText, medalColor && { color: MEDAL_TEXT_COLORS[entry.rank] }]}>{entry.rank}</Text>
            </View>
            {entry.user.profile_pic_url ? (
              <Image source={{ uri: entry.user.profile_pic_url }} style={[styles.avatar, medalColor && { borderWidth: 2.5, borderColor: medalColor }]} />
            ) : (
              <View style={[styles.avatar, medalColor && { borderWidth: 2.5, borderColor: medalColor }]} />
            )}
            <View style={styles.info}>
              <View style={styles.usernameRow}>
                <Text style={styles.username} numberOfLines={1}>
                  {entry.user.username}
                </Text>
                {isMine ? <Text style={styles.youTag}>{t("(you)")}</Text> : null}
              </View>
              <View style={styles.chipsRow}>
                {entry.partiesAttended > 0 ? (
                  <View style={styles.chip}>
                    <Ionicons name="calendar" size={11} color={colors.placeholder} />
                    <Text style={styles.chipText}>{entry.partiesAttended}</Text>
                  </View>
                ) : null}
                {entry.itemsAdded > 0 ? (
                  <View style={styles.chip}>
                    <Ionicons name="add-circle" size={11} color={colors.placeholder} />
                    <Text style={styles.chipText}>{entry.itemsAdded}</Text>
                  </View>
                ) : null}
                {entry.ratingsGiven > 0 ? (
                  <View style={styles.chip}>
                    <Ionicons name="star" size={11} color={colors.placeholder} />
                    <Text style={styles.chipText}>{entry.ratingsGiven}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scoreValue}>{entry.score}</Text>
              <Text style={styles.scoreLabel}>{t("pts").toUpperCase()}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default memo(CommunityLeaderboardRows);
