import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getShareFeed, toggleShareLike } from "../../api/shareService";
import { getSuggestions } from "../../api/userService";
import ShareCard from "../ShareCard";
import OnlineFriendsBar from "./OnlineFriendsBar";
import PeoplePodium from "../PeoplePodium";
import SuggestedUsersBox from "../SuggestedUsersBox";
import type { Share, SuggestedUser } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// One row of the rendered feed is either a real post or (every
// SUGGESTED_INTERVAL posts) a suggested-users insert — woven into the post
// stream instead of living in its own persistent section above the feed
// (moved here from KesfetSection.tsx's Discover tab after the user found a
// standalone rail there felt like a separate page). `occurrence` is which
// repeat this is (0, 1, 2, …) — used to rotate through different slices of
// the same fetched pool so repeat appearances don't show the identical 4
// people every time.
type FeedRow = { kind: "share"; share: Share } | { kind: "suggested"; occurrence: number };
const SUGGESTED_INTERVAL = 5;
const SUGGESTED_GRID_SIZE = 4;

const PAGE_LIMIT = 20;

// getSuggestedUsers (backend) is a real mutual-connection ranking (friends-
// of-friends, sorted by shared-follow count), hard-capped at 10 — not an
// arbitrary fixed "always 10" default, and not unlimited either. With only
// up to 10 real candidates and 4 shown per box, rotating through 4-at-a-
// time slices (wrapping around) is the honest way to make repeat
// appearances feel different without inventing fake users past what's
// actually a real, if small, candidate pool.
function suggestedSlice(pool: SuggestedUser[], occurrence: number): SuggestedUser[] {
  if (pool.length <= SUGGESTED_GRID_SIZE) return pool;
  const start = (occurrence * SUGGESTED_GRID_SIZE) % pool.length;
  const doubled = [...pool, ...pool];
  return doubled.slice(start, start + SUGGESTED_GRID_SIZE);
}

// The Medya feed. Previously had its own Sort (Recent/Popular/Network) +
// Type filter UI — the user found it cluttered and asked for the same
// treatment Discover's own tab bar got earlier this session: remove the
// control, don't need one at all. The backend blends recency + engagement
// + network into a single ranking (getShareFeed's own comment in
// shareController.js); type filtering was dropped entirely since every
// post already carries its own icon/color badge (ShareCard.tsx's
// typeMeta) for visual scanning, and dedicated full-browse pages already
// exist for Reviews/Lists specifically (/home/reviews,
// /home/lists-discover) for anyone who wants just one type. A single
// All/Friends toggle was added back later, directly requested — not a
// revival of the old Sort/Type combo, just a hard filter on the exact
// same ranking ("I sometimes want to see only my friends' posts," not "I
// want to change how posts are ranked").
export default function SharesFeedSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
        error: { color: colors.error, textAlign: "center", marginTop: 8 },
        // `marginHorizontal: -16` cancels this FlatList's own `list`
        // paddingHorizontal:16, same reasoning as `podiumInset` below —
        // OnlineFriendsBar's own internal `paddingHorizontal:16` (its
        // label and scroll content) was stacking ON TOP of the list's
        // padding, landing its "ONLINE FRIENDS" label a full 32px from the
        // screen edge instead of 16px, visibly further right than the
        // podium's and "Shares"' own titles — a direct ask to fix.
        onlineFriendsInset: { marginHorizontal: -16, marginBottom: 14 },
        // PeoplePodium's own internal horizontal ScrollView pages are
        // sized to the full screen width (useWindowDimensions), so they
        // need to cancel this FlatList's own `list` paddingHorizontal:16
        // or the pages render 16px too narrow on each side and the whole
        // podium reads as shifted off-center.
        podiumInset: { marginHorizontal: -16, marginBottom: 4 },
        // A section title right above the actual posts, styled to match
        // the podium's own title text — jumping straight from the podium
        // into the post list with no label of its own read as confusing
        // (the user's own words), since the podium doesn't visually
        // announce "here's where it ends and the feed begins." The toggle
        // sits directly after the title text ends (gap, not
        // space-between) per direct ask — it used to be pushed all the way
        // to the row's far edge.
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
        postsTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        // All/Friends toggle, same exact shape as PeoplePodium.tsx's own
        // modeToggle (movie/series) — one pill, two icons side by side, no
        // text/no per-option background, just icon color marking which
        // side is active. Reused verbatim (same height/radius/padding/gap/
        // border) per direct ask to match that podium's own design
        // language rather than the previous round's separate-pill-per-
        // option/text-label version.
        scopeToggle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 34,
          paddingHorizontal: 12,
          borderRadius: 17,
          backgroundColor: colors.base200,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        // Renders between *every* pair of adjacent rows (FlatList's own
        // ItemSeparatorComponent, not a border baked into ShareCard/
        // SuggestedUsersBox individually) — the only way to get a line
        // between a post and the Suggested Users box too, not just between
        // two posts. Same hairline OnlineFriendsBar's own container border
        // already uses (StyleSheet.hairlineWidth, colors.border). Width:
        // `marginHorizontal: 12`, not the earlier full-bleed `-16` — per
        // direct ask, the line should match the actual bordered post box's
        // own width (ShareCard.tsx's shareBox/analysisBox/listBox all use
        // `marginHorizontal: 12` inside this FlatList's own
        // paddingHorizontal:16), not stretch edge-to-edge past it.
        rowSeparator: { marginHorizontal: 12, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 14 },
        // Same hairline again, placed once between the podium and the
        // "Shares" title row per direct ask — a plain View since it's a
        // single fixed spot, not a repeating FlatList separator.
        titleDivider: { marginHorizontal: -16, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 14 },
      }),
    [colors]
  );

  const [items, setItems] = useState<Share[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "following">("all");
  const cycleScope = () => setScope((prev) => (prev === "all" ? "following" : "all"));

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  useEffect(() => {
    getSuggestions(10)
      .then(setSuggestions)
      .catch(() => {});
  }, []);

  // Re-inserts the suggested-users box after every SUGGESTED_INTERVAL
  // posts (not just once) — the user's own ask, so it keeps reappearing as
  // they keep scrolling rather than being seen at most one time per
  // session. Recomputes from scratch whenever `items` changes (fresh load
  // or a loadMore append), so insert positions stay correct without ever
  // duplicating.
  const feedRows: FeedRow[] = useMemo(() => {
    const rows: FeedRow[] = [];
    let occurrence = 0;
    items.forEach((share, i) => {
      rows.push({ kind: "share", share });
      if (suggestions.length > 0 && (i + 1) % SUGGESTED_INTERVAL === 0) {
        rows.push({ kind: "suggested", occurrence });
        occurrence++;
      }
    });
    return rows;
  }, [items, suggestions]);

  const load = useCallback(async () => {
    try {
      const res = await getShareFeed(1, PAGE_LIMIT, scope);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load content."));
    }
  }, [t, scope]);

  // Re-runs (via `load`'s own `scope` dependency above) whenever the
  // All/Friends toggle changes, same as the very first mount — no separate
  // effect needed for the toggle specifically.
  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getShareFeed(nextPage, PAGE_LIMIT, scope);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (shareId: string) => {
    const prev = items;
    setItems((cur) =>
      cur.map((s) => (s._id !== shareId ? s : { ...s, liked: !s.liked, likeCount: s.liked ? Math.max(0, s.likeCount - 1) : s.likeCount + 1 }))
    );
    try {
      await toggleShareLike(shareId);
    } catch {
      setItems(prev);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Previously branched `loading ? <View>…<PeoplePodium/>…</View> : <FlatList ListHeaderComponent={…<PeoplePodium/>…}>` —
          two structurally different trees, each with its own <PeoplePodium/>. React's
          reconciler doesn't diff across a ternary's two branches, so the moment this
          section's own feed fetch finished and `loading` flipped, it unmounted the
          first PeoplePodium (destroying its already-fetched data) and mounted a brand
          new one — which then had to fetch and load all over again. That's the exact
          "podyum yüklenip gidiyor, sonra tekrar yükleniyor" bug: the podium loading
          twice wasn't it being slow, it was being torn down and rebuilt once this
          section's own unrelated feed happened to finish. Fix: the FlatList (and
          PeoplePodium/OnlineFriendsBar inside its header) is now always mounted —
          `loading` only swaps content *inside* the header, never the tree position of
          PeoplePodium itself, so it mounts once and keeps its own state regardless of
          how this section's own feed load is going. */}
      <FlatList
        style={styles.container}
        data={feedRows}
        keyExtractor={(row) => (row.kind === "share" ? row.share._id : `suggested-${row.occurrence}`)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <>
            <View style={styles.onlineFriendsInset}>
              <OnlineFriendsBar />
            </View>
            <View style={styles.podiumInset}>
              <PeoplePodium />
            </View>
            <View style={styles.titleDivider} />
            {/* Title row always renders (not gated behind `loading` like
                the spinner/error below it used to be entirely) so the
                toggle stays tappable/visible through a reload, not just
                popping in once the first fetch finishes. */}
            <View style={styles.titleRow}>
              <Text style={styles.postsTitle}>{t("Shares")}</Text>
              {/* One Pressable wrapping both icons, same interaction as
                  PeoplePodium's own modeToggle — a single tap anywhere on
                  the pill cycles scope, not two independently tappable
                  icons. Globe = everyone's posts, people = just your
                  network's — same "outline glyph, active one tinted
                  primary" language as that toggle's own film/tv icons. */}
              <Pressable style={styles.scopeToggle} onPress={cycleScope} hitSlop={8}>
                <Ionicons name="globe-outline" size={16} color={scope === "all" ? colors.primary : colors.placeholder} />
                <Ionicons name="people-outline" size={16} color={scope === "following" ? colors.primary : colors.placeholder} />
              </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
            ) : (
              error && <Text style={styles.error}>{error}</Text>
            )}
          </>
        }
        renderItem={({ item: row }) =>
          row.kind === "suggested" ? (
            <SuggestedUsersBox users={suggestedSlice(suggestions, row.occurrence)} />
          ) : (
            <ShareCard share={row.share} basePath="/home" onToggleLike={() => handleToggleLike(row.share._id)} />
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t("No shares yet.")}</Text> : null}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
      />
    </View>
  );
}
