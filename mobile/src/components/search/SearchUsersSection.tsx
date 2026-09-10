import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { searchUsers } from "../../api/userService";
import UserAvatar from "../UserAvatar";
import type { UserSearchResult } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const PAGE_LIMIT = 30;

interface Props {
  query: string;
}

// Users tab of the Search page — a plain vertical avatar+username list (no
// existing component matches this exact shape, unlike the other 4 tabs
// which all reuse an established card). Used to default (empty query) to a
// random sample from the backend's own $sample branch — same "browse
// before you search" issue the other 4 tabs had, fixed the same way:
// nothing loads until the viewer actually types a name. No filter here (an
// explicit ask, decided against) — unlike genre/year or rating/sort, there's
// no rich-enough signal on a bare username+avatar+tier result to filter by
// that would actually be useful, and "find this person by name" doesn't
// naturally want narrowing the way the other four tabs' browsing does.
export default function SearchUsersSection({ query }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { padding: 16, flexGrow: 1 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        username: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, marginHorizontal: 32, fontSize: 14, lineHeight: 20 },
      }),
    [colors]
  );

  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasQuery = query.trim().length > 0;

  // Same out-of-order-response guard as SearchContentRows.tsx — see its own
  // comment for the full reasoning.
  const requestIdRef = useRef(0);

  // The backend's own searchUsers already supports real page/limit
  // pagination (used elsewhere, e.g. the follow-request pickers) — this tab
  // just never called it with more than page 1 before, so anything past the
  // first 30 matches was unreachable despite the server already being able
  // to serve it.
  const loadPage = useCallback(
    async (pageNum: number, append: boolean, requestId: number) => {
      try {
        const { items, pagination } = await searchUsers(query, pageNum, PAGE_LIMIT);
        if (requestIdRef.current !== requestId) return;
        setUsers((prev) => (append ? [...prev, ...items] : items));
        setHasMore(pagination ? pageNum < pagination.pages : items.length > 0);
        setError(null);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(e?.response?.data?.message || t("Failed to load users."));
      }
    },
    [query]
  );

  useEffect(() => {
    if (!hasQuery) {
      setUsers([]);
      setHasLoadedOnce(false);
      return;
    }
    setLoading(true);
    setPage(1);
    const requestId = ++requestIdRef.current;
    loadPage(1, false, requestId).finally(() => {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    });
  }, [loadPage, hasQuery]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, true, requestId);
    if (requestIdRef.current === requestId) setPage(nextPage);
    setLoadingMore(false);
  };

  if (!hasQuery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base100, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="person-outline" size={40} color={colors.placeholder} />
        <Text style={styles.empty}>{t("Search any username you want to find them.")}</Text>
      </View>
    );
  }

  if (loading && !hasLoadedOnce) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.base100 }} color={colors.primary} />;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.base100 }}
      data={users}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/user/${item._id}`)}>
          <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={40} />
          <Text style={styles.username}>{item.username}</Text>
        </Pressable>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
