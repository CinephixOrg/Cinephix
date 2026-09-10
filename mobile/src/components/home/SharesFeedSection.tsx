import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// repeat this is (0, 1, 2, …) — SuggestedUsersBox.tsx's own job now to turn
// that plus the full `suggestions` pool into an actual 4-person slice (was
// computed here and passed down as an already-sliced array, which meant a
// fresh array reference on every render and no way for that box to ever be
// memoized — see that component's own doc comment).
type FeedRow = { kind: "share"; share: Share } | { kind: "suggested"; occurrence: number };
const SUGGESTED_INTERVAL = 5;

const PAGE_LIMIT = 20;

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
//
// Wrapped in React.memo — takes zero props, so this is purely about
// stopping `home/index.tsx`'s own re-renders from cascading down into a
// full re-render of this entire subtree (a live FlatList of ShareCards
// plus PeoplePodium) every time. That cascade was already happening on
// every single tap of the header's Paylaşımlar/Keşfet pill (`switchTab`
// there calls `setOuterTab`, re-rendering the whole screen) even before
// any of this session's changes — reported live as new stutter once this
// subtree got heavier (tier-lock logic in PeoplePodiumCard, the new
// like-color crossfade in every visible ShareCard), landing at the exact
// moment the header's own slide animation needs the JS thread free to stay
// smooth (its pill position isn't native-driven — see CapsuleTabSwitcher's
// own dragOffsetX plumbing in home/index.tsx).
interface Props {
  // Set only by home/index.tsx when arriving from PodiumNewsModal.tsx's own
  // "you made the podium!" popup — threaded straight through to
  // PeoplePodium, which is the one that actually knows how to turn this
  // into a page jump. Optional, `undefined` at every other call site
  // (there's only ever the one), so this doesn't disturb this component's
  // own memo() re-render guard in the common case.
  jumpToPodiumCategory?: string;
  // Set only by home/index.tsx's own `?scope=following` param (an
  // official-account tip's "Friends tab" link uses this) — just the
  // initial value for the existing `scope` state below, same one-shot-seed
  // idea as jumpToPodiumCategory itself.
  initialScope?: "all" | "following";
}

function SharesFeedSection({ jumpToPodiumCategory, initialScope }: Props) {
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
  const [scope, setScope] = useState<"all" | "following">(initialScope || "all");
  const cycleScope = () => setScope((prev) => (prev === "all" ? "following" : "all"));

  // Used to only ever fetch once per mount — since this section stays
  // mounted for the whole session (React.memo'd, never remounts on tab
  // switches), a long session kept recycling the exact same 10-person pool
  // forever, even as the viewer's own mutual-connection graph changed.
  // Re-fetched on manual pull-to-refresh too now (not a new polling
  // interval — reusing the one trigger the viewer already has for "give me
  // anything new").
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const loadSuggestions = useCallback(() => {
    getSuggestions(10)
      .then(setSuggestions)
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

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

  // Guards against out-of-order responses — same reasoning as Search's own
  // fetch-driven components (SearchContentRows.tsx etc.): rapidly toggling
  // All/Friends, or toggling it while a loadMore is still in flight, used to
  // have no protection against a slower, now-stale response overwriting (or
  // getting appended onto) whatever the newer request already loaded.
  // PeoplePodium.tsx's own fetch already guards this correctly (a plain
  // `cancelled` flag) — this was the one fetch on this page that didn't.
  const requestIdRef = useRef(0);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(
    async (requestId: number) => {
      try {
        const res = await getShareFeed(1, PAGE_LIMIT, scope);
        if (requestIdRef.current !== requestId) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setPage(1);
        setError(null);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(e?.response?.data?.message || t("Failed to load content."));
      }
    },
    [t, scope]
  );

  // Re-runs (via `load`'s own `scope` dependency above) whenever the
  // All/Friends toggle changes, same as the very first mount — no separate
  // effect needed for the toggle specifically. Also scrolls back to the top
  // on every such change — switching scope used to leave the list at
  // whatever offset the viewer happened to be scrolled to, which could land
  // in the middle of (or past the end of) the new, differently-sized list.
  useEffect(() => {
    setLoading(true);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    const requestId = ++requestIdRef.current;
    load(requestId).finally(() => {
      if (requestIdRef.current === requestId) setLoading(false);
    });
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    loadSuggestions();
    const requestId = ++requestIdRef.current;
    await load(requestId);
    if (requestIdRef.current === requestId) setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getShareFeed(nextPage, PAGE_LIMIT, scope);
      if (requestIdRef.current !== requestId) return;
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      if (requestIdRef.current === requestId) setLoadingMore(false);
    }
  };

  // A stable ([]) reference on purpose — passed straight into ShareCard
  // (itself now React.memo'd, see below) rather than wrapped in a fresh
  // inline arrow per row every render. The rollback-on-failure used to
  // read `items` directly from the closure (needing it in a dependency
  // array, which would recreate this function — and every row's own
  // ShareCard prop — on every fetch/page-load/like anywhere in the feed);
  // now captures just the one row's own pre-toggle snapshot inside the
  // functional setItems updater instead, so this never needs to depend on
  // `items` at all.
  const handleToggleLike = useCallback(async (shareId: string) => {
    let previous: Share | undefined;
    setItems((cur) =>
      cur.map((s) => {
        if (s._id !== shareId) return s;
        previous = s;
        return { ...s, liked: !s.liked, likeCount: s.liked ? Math.max(0, s.likeCount - 1) : s.likeCount + 1 };
      })
    );
    try {
      await toggleShareLike(shareId);
    } catch {
      const restored = previous;
      if (restored) setItems((cur) => cur.map((s) => (s._id === shareId ? restored : s)));
    }
  }, []);

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
        ref={flatListRef}
        style={styles.container}
        data={feedRows}
        // Suffixed with `index` (not just `share._id`) for share rows —
        // the official Cinephix account's own posts are deliberately
        // recycled once getShareFeed's fixed-position rotation (see that
        // function's own comment) runs through its whole pool, which a
        // small pool (a handful of posts early on) can do within a single
        // scroll session. The SAME official Share _id then legitimately
        // occupies two different rows at once, which without the index
        // suffix is a duplicate FlatList key — React can't tell the two
        // rows apart while reconciling, which is exactly what the real,
        // reported "sayfa saçmalıyor, yukarı aşağı zıplıyor" bug was.
        // Safe to always include the index: `items` only ever grows via
        // `loadMore`'s append or gets wholesale-replaced by `load`/
        // `onRefresh` — existing rows never reorder or get spliced out in
        // place, so a row's own index is as stable as its `_id` here.
        keyExtractor={(row, index) => (row.kind === "share" ? `${row.share._id}-${index}` : `suggested-${row.occurrence}`)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <>
            <View style={styles.onlineFriendsInset}>
              <OnlineFriendsBar />
            </View>
            <View style={styles.podiumInset}>
              <PeoplePodium jumpToCategory={jumpToPodiumCategory} />
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
            <SuggestedUsersBox pool={suggestions} occurrence={row.occurrence} />
          ) : (
            <ShareCard share={row.share} basePath="/home" onToggleLike={handleToggleLike} />
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

export default memo(SharesFeedSection);
