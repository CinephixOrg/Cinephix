import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  acceptFollowRequest,
  getFollowers,
  getFollowing,
  getPendingRequests,
  getSuggestions,
  rejectFollowRequest,
  removeFollower,
} from "../src/api/userService";
import { useAuth } from "../src/context/AuthContext";
import FollowButton from "../src/components/FollowButton";
import ContentRail from "../src/components/ContentRail";
import SuggestedUserCard from "../src/components/SuggestedUserCard";
import { SkeletonRow } from "../src/components/Skeleton";
import type { Connection, FollowRequestUser, SuggestedUser } from "../src/types";
import { useTheme } from "../src/context/ThemeContext";
import { useToast } from "../src/context/ToastContext";
import { fonts } from "../src/theme/typography";

type Tab = "followers" | "following" | "requests";

export default function NetworkScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
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
  rowText: { flex: 1 },
  username: { fontSize: 15, color: colors.baseContent, fontFamily: fonts.medium },
  bio: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
  followButtonSmall: { minWidth: 0 },
  removeButton: { paddingHorizontal: 8, paddingVertical: 6 },
  removeButtonText: { color: colors.error, fontSize: 12, fontFamily: fonts.medium },
  requestActions: { flexDirection: "row", gap: 8 },
  acceptButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptButtonText: { color: colors.primaryContent, fontSize: 12, fontFamily: fonts.bold },
  rejectButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rejectButtonText: { color: colors.baseContent, fontSize: 12, fontFamily: fonts.medium },
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

  const [tab, setTab] = useState<Tab>(params.tab === "following" || params.tab === "requests" ? params.tab : "followers");

  const [items, setItems] = useState<Connection[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<FollowRequestUser[]>([]);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);

  useEffect(() => {
    navigation.setOptions({
      title: tab === "followers" ? t("Followers") : tab === "following" ? t("Following") : t("Requests"),
    });
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      if (isOwn) {
        getPendingRequests()
          .then(setPendingRequests)
          .catch(() => {});
        getSuggestions(10)
          .then(setSuggestions)
          .catch(() => {});
      }
    }, [isOwn])
  );

  const load = useCallback(
    async (pageNum: number, currentTab: Tab, append: boolean) => {
      if (currentTab === "requests" || !targetId) return;
      try {
        const fetcher = currentTab === "followers" ? getFollowers : getFollowing;
        const { items: newItems, pagination } = await fetcher(pageNum, 20, params.userId);
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setHasMore(pagination ? pageNum < pagination.pages : newItems.length > 0);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load list."));
      }
    },
    [targetId, params.userId]
  );

  useFocusEffect(
    useCallback(() => {
      if (tab === "requests") {
        setLoading(false);
        return;
      }
      setLoading(true);
      setPage(1);
      load(1, tab, false).finally(() => setLoading(false));
    }, [tab, load])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading || tab === "requests") return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await load(nextPage, tab, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleRemove = async (followerId: string) => {
    setItems((prev) => prev.filter((it) => it._id !== followerId));
    try {
      await removeFollower(followerId);
    } catch {
      load(1, tab, false);
      showToast(t("Something went wrong. Please try again."));
    }
  };

  const handleAccept = async (requesterId: string) => {
    if (!user) return;
    setRequestActionId(requesterId);
    try {
      await acceptFollowRequest(user._id, requesterId);
      setPendingRequests((prev) => prev.filter((r) => r._id !== requesterId));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load request."));
    } finally {
      setRequestActionId(null);
    }
  };

  const handleReject = async (requesterId: string) => {
    if (!user) return;
    setRequestActionId(requesterId);
    try {
      await rejectFollowRequest(user._id, requesterId);
      setPendingRequests((prev) => prev.filter((r) => r._id !== requesterId));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load request."));
    } finally {
      setRequestActionId(null);
    }
  };

  const showRequestsTab = isOwn && (pendingRequests.length > 0 || tab === "requests");

  return (
    <View style={styles.container}>
      {isOwn && (
        <ContentRail
          title={t("Suggested Users")}
          data={suggestions}
          keyExtractor={(item) => item._id}
          emptyText={t("No suggestions yet.")}
          renderItem={(item) => <SuggestedUserCard user={item} />}
        />
      )}

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
        {showRequestsTab && (
          <Pressable
            style={[styles.tabButton, tab === "requests" && styles.tabButtonActive]}
            onPress={() => setTab("requests")}
          >
            <Text style={[styles.tabButtonText, tab === "requests" && styles.tabButtonTextActive]}>
              {t("Requests")}
            </Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {tab === "requests" ? (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.profile_pic_url ? (
                <Image source={{ uri: item.profile_pic_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{item.username.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <Pressable style={styles.rowText} onPress={() => router.push(`/user/${item._id}`)}>
                <Text style={styles.username}>{item.username}</Text>
                {item.bio ? (
                  <Text style={styles.bio} numberOfLines={1}>
                    {item.bio}
                  </Text>
                ) : null}
              </Pressable>
              {requestActionId === item._id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.requestActions}>
                  <Pressable style={styles.acceptButton} onPress={() => handleAccept(item._id)}>
                    <Text style={styles.acceptButtonText}>{t("Accept")}</Text>
                  </Pressable>
                  <Pressable style={styles.rejectButton} onPress={() => handleReject(item._id)}>
                    <Text style={styles.rejectButtonText}>{t("Reject")}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t("No pending requests.")}</Text>}
        />
      ) : loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
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
                  <Text style={styles.avatarFallbackText}>{item.username.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <Pressable style={styles.rowText} onPress={() => router.push(`/user/${item._id}`)}>
                <Text style={styles.username}>{item.username}</Text>
              </Pressable>
              <FollowButton targetUserId={item._id} size="small" style={styles.followButtonSmall} />
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

