import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { getFollowers, getFollowing } from "../../../src/api/userService";
import { SkeletonRow } from "../../../src/components/Skeleton";
import type { Connection } from "../../../src/types";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

type Tab = "followers" | "following";

export default function ConnectionsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>(params.tab === "following" ? "following" : "followers");

  const [items, setItems] = useState<Connection[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: tab === "followers" ? t("Followers") : t("Following") });
  }, [tab]);

  const load = useCallback(async (pageNum: number, currentTab: Tab, append: boolean) => {
    try {
      const fetcher = currentTab === "followers" ? getFollowers : getFollowing;
      const { items: newItems, pagination } = await fetcher(pageNum);
      setItems((prev) => (append ? [...prev, ...newItems] : newItems));
      setHasMore(pagination ? pageNum < pagination.pages : newItems.length > 0);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load list."));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(1, tab, false).finally(() => setLoading(false));
  }, [tab, load]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await load(nextPage, tab, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, tab === "followers" && styles.tabButtonActive]}
          onPress={() => setTab("followers")}
        >
          <Text style={[styles.tabButtonText, tab === "followers" && styles.tabButtonTextActive]}>
            {t("Followers")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === "following" && styles.tabButtonActive]}
          onPress={() => setTab("following")}
        >
          <Text style={[styles.tabButtonText, tab === "following" && styles.tabButtonTextActive]}>
            {t("Following")}
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.profile_pic_url ? (
                <Image source={{ uri: item.profile_pic_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {item.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.username}>{item.username}</Text>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === "followers" ? t("No followers yet.") : t("Not following anyone yet.")}
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  tabRow: { flexDirection: "row", padding: 16, gap: 8 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
  tabButtonTextActive: { color: colors.primaryContent },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  username: { fontSize: 15, color: colors.baseContent },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
});
