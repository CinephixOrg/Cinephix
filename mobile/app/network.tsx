import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getFollowers, getFollowing, getSuggestions, removeFollower } from "../src/api/userService";
import { getCachedConnections, invalidateConnections, setCachedConnections } from "../src/api/connectionsCache";
import { useAuth } from "../src/context/AuthContext";
import FollowButton from "../src/components/FollowButton";
import ContentRail from "../src/components/ContentRail";
import SuggestedUserCard from "../src/components/SuggestedUserCard";
import TierAvatarFrame from "../src/components/TierAvatarFrame";
import { SkeletonRow } from "../src/components/Skeleton";
import type { Connection, SuggestedUser } from "../src/types";
import { useTheme } from "../src/context/ThemeContext";
import { useToast } from "../src/context/ToastContext";
import { fonts } from "../src/theme/typography";

type Tab = "followers" | "following";
const AVATAR_SIZE = 44;
// Suggested Users is hidden per product request, not removed — the fetch
// (getSuggestions) and its state below are untouched, only the JSX render
// is gated, so flipping this back to true is the entire reintegration.
const SHOW_SUGGESTED_USERS = false;

export default function NetworkScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  // Flat, equal-width, edge-to-edge tabs directly under the header — a
  // thin divider under the whole row, with the active tab's own bottom
  // border overlapping it in the primary color. Same shape Instagram uses
  // for this exact screen, replacing the old filled-pill buttons.
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: { borderBottomColor: colors.primary },
  tabButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.placeholder },
  tabButtonTextActive: { color: colors.baseContent, fontFamily: fonts.bold },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatarFallback: { backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  rowText: { flex: 1 },
  username: { fontSize: 15, color: colors.baseContent, fontFamily: fonts.medium },
  followButtonSmall: { minWidth: 0 },
  removeButton: { paddingHorizontal: 8, paddingVertical: 6 },
  removeButtonText: { color: colors.error, fontSize: 12, fontFamily: fonts.medium },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
}), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ tab?: string; userId?: string; username?: string }>();

  const isOwn = !params.userId || params.userId === user?._id;
  const targetId = params.userId || user?._id || "";

  const [tab, setTab] = useState<Tab>(params.tab === "following" ? "following" : "followers");

  const [items, setItems] = useState<Connection[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);

  // Counts for both tab labels ("3 Followers" / "24 Following") — fetched
  // independently of which list is actually loaded/active (limit:1, only
  // pagination.total is read) so both numbers are correct immediately
  // rather than only appearing once that tab has been visited.
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  // The page title used to just repeat whatever tab was active
  // ("Followers"/"Following"), which is redundant now that the subtabs
  // already say that — shows the profile's own username instead.
  useEffect(() => {
    navigation.setOptions({ title: params.username || (isOwn ? user?.username : "") || "" });
  }, [navigation, params.username, isOwn, user?.username]);

  // The two tab labels' counts used to cost two dedicated round trips —
  // getFollowers(1, 1) and getFollowing(1, 1) — whose whole purpose was to
  // read one number out of each pagination envelope, on top of the request
  // that actually fetches the visible list. Both lists now report both
  // totals, so the list request below fills these in for free.
  const applyCounts = useCallback((counts?: { followers: number; following: number }) => {
    if (!counts) return;
    setFollowersCount(counts.followers);
    setFollowingCount(counts.following);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isOwn) {
        getSuggestions(10)
          .then(setSuggestions)
          .catch(() => {});
      }
    }, [isOwn])
  );

  const load = useCallback(
    async (pageNum: number, currentTab: Tab, append: boolean) => {
      if (!targetId) return;
      try {
        const fetcher = currentTab === "followers" ? getFollowers : getFollowing;
        const { items: newItems, pagination, counts } = await fetcher(pageNum, 20, params.userId);
        const more = pagination ? pageNum < pagination.pages : newItems.length > 0;
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setHasMore(more);
        setError(null);
        applyCounts(counts);
        // Only page 1 is cached: it's what a return visit needs to render
        // instantly, and holding every page someone scrolled through would
        // grow without bound for no benefit.
        if (!append) {
          setCachedConnections(targetId, currentTab, { items: newItems, hasMore: more, counts });
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load list."));
      }
    },
    [targetId, params.userId, applyCounts]
  );

  // Renders the last known page immediately and refreshes behind it.
  //
  // This used to blank the list and show a full-screen spinner on every
  // focus — so tapping someone, looking at their profile and coming back
  // meant watching the whole list load again from nothing, even though it
  // had been on screen a second earlier. The spinner is now only for a list
  // this session has never shown.
  useFocusEffect(
    useCallback(() => {
      if (!targetId) {
        setLoading(false);
        return;
      }
      const cached = getCachedConnections(targetId, tab);
      if (cached) {
        setItems(cached.items);
        setHasMore(cached.hasMore);
        applyCounts(cached.counts);
        setLoading(false);
      } else {
        setItems([]);
        setLoading(true);
      }
      setPage(1);
      load(1, tab, false).finally(() => setLoading(false));
    }, [tab, load, targetId, applyCounts])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await load(nextPage, tab, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleRemove = async (followerId: string) => {
    setItems((prev) => prev.filter((it) => it._id !== followerId));
    setFollowersCount((prev) => (prev != null ? prev - 1 : prev));
    // The optimistic removal above is only in this screen's state — without
    // this the cached page would put them back on the next visit.
    if (targetId) invalidateConnections(targetId);
    try {
      await removeFollower(followerId);
    } catch {
      load(1, tab, false);
      setFollowersCount((prev) => (prev != null ? prev + 1 : prev));
      showToast(t("Something went wrong. Please try again."));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, tab === "followers" && styles.tabButtonActive]}
          onPress={() => setTab("followers")}
        >
          <Text style={[styles.tabButtonText, tab === "followers" && styles.tabButtonTextActive]}>
            {followersCount != null ? t("{{count}} Followers", { count: followersCount }) : t("Followers")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === "following" && styles.tabButtonActive]}
          onPress={() => setTab("following")}
        >
          <Text style={[styles.tabButtonText, tab === "following" && styles.tabButtonTextActive]}>
            {followingCount != null ? t("{{count}} Following", { count: followingCount }) : t("Following")}
          </Text>
        </Pressable>
      </View>

      {SHOW_SUGGESTED_USERS && isOwn && (
        <ContentRail
          title={t("Suggested Users")}
          data={suggestions}
          keyExtractor={(item) => item._id}
          emptyText={t("No suggestions yet.")}
          renderItem={(item) => <SuggestedUserCard user={item} />}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable onPress={() => router.push(`/user/${item._id}`)}>
                <TierAvatarFrame tier={item.accountTier} size={AVATAR_SIZE}>
                  {(innerSize) =>
                    item.profile_pic_url ? (
                      <Image
                        source={{ uri: item.profile_pic_url }}
                        style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
                      />
                    ) : (
                      <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                        <Text style={styles.avatarFallbackText}>{item.username.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )
                  }
                </TierAvatarFrame>
              </Pressable>
              <Pressable style={styles.rowText} onPress={() => router.push(`/user/${item._id}`)}>
                <Text style={styles.username}>{item.username}</Text>
              </Pressable>
              <FollowButton
                targetUserId={item._id}
                size="small"
                style={styles.followButtonSmall}
                onStatusChange={(status) => {
                  // This button always reflects *your own* following
                  // relationship with the row's user — true in both the
                  // Followers and Following tabs — so a transition here
                  // always adjusts followingCount, never followersCount.
                  if (status === "not-following") {
                    setFollowingCount((prev) => (prev != null ? prev - 1 : prev));
                  } else if (status === "following") {
                    setFollowingCount((prev) => (prev != null ? prev + 1 : prev));
                  }
                }}
              />
              {tab === "followers" && isOwn && (
                <Pressable onPress={() => handleRemove(item._id)} hitSlop={8} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>{t("Remove")}</Text>
                </Pressable>
              )}
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
