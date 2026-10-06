import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { getGroupLeaderboard } from "../api/groupService";
import CommunityLeaderboardRows from "../components/socials/CommunityLeaderboardRows";
import type { GroupLeaderboardEntry } from "../types";

// "See all" behind Overview's own top-3 slice — the exact same row design,
// just every ranked member instead of just the top 3.
export default function CommunityLeaderboardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[] | undefined>(undefined);

  const load = useCallback(() => {
    if (!slug) return;
    getGroupLeaderboard(slug)
      .then((r) => setLeaderboard(r.leaderboard))
      .catch(() => setLeaderboard((current) => current ?? []));
  }, [slug]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("This Week's Leaderboard") });
  }, [navigation, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        content: { padding: 16, paddingBottom: 40 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, paddingHorizontal: 32 },
      }),
    [colors]
  );

  if (leaderboard === undefined) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.empty}>{t("No activity yet this week.")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CommunityLeaderboardRows entries={leaderboard} />
    </ScrollView>
  );
}
