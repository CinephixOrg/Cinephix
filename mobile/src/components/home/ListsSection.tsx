import { useCallback, useEffect, useState, useMemo } from "react";
import { ScrollView, RefreshControl, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { discoverLists, getPopularLists } from "../../api/listService";
import DiscoverListCard from "../DiscoverListCard";
import { SkeletonRail } from "../Skeleton";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Lists tab: "Lists from Friends" (discoverLists() already returns a
// fromFollowing flag per list, mixed with community backfill, so this
// filters client-side rather than needing a new backend-only-friends mode)
// plus "Popular Lists" (new — ranked by like count).
export default function ListsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { paddingVertical: 16, paddingHorizontal: 16, flexGrow: 1 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 12 },
        empty: { color: colors.placeholder, fontSize: 13, marginBottom: 20 },
      }),
    [colors]
  );

  const [fromFriends, setFromFriends] = useState<DiscoverListItem[]>([]);
  const [popular, setPopular] = useState<DiscoverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [discoverRes, popularRes] = await Promise.all([discoverLists(50), getPopularLists(20)]);
      setFromFriends(discoverRes.filter((l) => l.fromFollowing));
      setPopular(popularRes);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openList = (id: string) => router.push(`/home/lists/${id}`);

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.container}>
        <SkeletonRail />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.base100 }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>{t("Lists from Friends")}</Text>
      {fromFriends.length === 0 ? (
        <Text style={styles.empty}>{t("No public lists from people you follow yet.")}</Text>
      ) : (
        fromFriends.map((list) => (
          <DiscoverListCard key={list._id} list={list} onPress={() => openList(list._id)} basePath="/home" />
        ))
      )}

      <Text style={styles.sectionTitle}>{t("Popular Lists")}</Text>
      {popular.length === 0 ? (
        <Text style={styles.empty}>{t("No popular lists yet.")}</Text>
      ) : (
        popular.map((list) => (
          <DiscoverListCard key={list._id} list={list} onPress={() => openList(list._id)} basePath="/home" />
        ))
      )}
    </ScrollView>
  );
}
