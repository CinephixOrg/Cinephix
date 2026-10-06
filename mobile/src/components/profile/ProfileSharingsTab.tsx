import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Pressable from "../common/TapSafePressable";
// A Modal needs its own gesture root for the app's Pressables to work inside it.
import Modal from "../common/GestureModal";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getUserShares, toggleShareLike, SHARES_PREVIEW_LIMIT } from "../../api/shareService";
import ShareCard, { typeMeta } from "../ShareCard";
import ShareGridTile from "./ShareGridTile";
import type { Share, ShareType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import AdBanner from "../ads/AdBanner";
import { AD_UNIT_IDS } from "../../constants/adUnitIds";

// Every real, user-creatable share type — same list shareController.js's
// own FILTERABLE_SHARE_TYPES enforces server-side ("official" excluded,
// never a poster's own profile). Order matches the + button's own 5
// categories (PostComposeMenu.tsx) with "list" appended after — the one
// category that button doesn't cover (see its own round for why).
const FILTER_CATEGORIES: ShareType[] = ["recommendation", "review", "analysis", "poll", "badge", "list"];


// How long a fetched share list is treated as current when this tab is
// brought back into view. Short, because posting a share is exactly the
// thing a user does right before coming here to look at it.
const REVALIDATE_TTL_MS = 15_000;
const SHARINGS_COLUMNS = 3;
const SHARINGS_GAP = 6;
const SHARINGS_PADDING = 16;
// Feed mode's own page size — separate from SHARES_PREVIEW_LIMIT (the
// grid's fixed capped preview), since feed mode is genuinely paginated.
const FEED_PAGE_LIMIT = 12;

type ViewMode = "grid" | "feed";

// Shares category body, shared by own profile (default userId="me") and
// public profile (explicit userId). Two view modes now (direct ask,
// "grid gösterim bir de akış gösterimi... mod seçimi gibi"): grid (the
// original behaviour, a capped 3-column thumbnail preview, tap-to-expand
// modal) and feed (real inline ShareCards, one per row, real pagination).
//
// Both modes render inside the SAME parent ScrollView every other category
// body already does (ProfileCategoryTabs.tsx/PublicProfileCategoryTabs.tsx
// — see profile/index.tsx's own comment on why: a nested FlatList inside
// that ScrollView trips RN's VirtualizedList warning and doesn't actually
// virtualize anything useful there anyway). So feed mode's own "load more
// as you scroll down" is NOT a FlatList's onEndReached — it's driven by
// `nearBottomRef`, a plain ref the parent screen's own ScrollView writes a
// near-bottom signal into, which this tab only ever populates while its
// own feed mode is the active one. This keeps memory bounded the way the
// user actually asked ("memory efficient") — pages are fetched and
// appended incrementally, never all up front — even though, being a plain
// `.map()` of ShareCards rather than a true virtualized list, rows already
// scrolled past still stay mounted rather than being recycled. A full
// virtualized feed would need converting this screen's own outer
// ScrollView into a FlatList/SectionList, a much larger restructure
// touching every other category tab too — out of scope for this ask.
interface Props {
  userId?: string;
  basePath?: "/home" | "/profile" | `/user/${string}`;
  // Whether this tab is the one currently on screen. Only the own-profile
  // caller keeps it mounted while hidden, so everywhere else this stays
  // true and the revalidation below is a no-op.
  active?: boolean;
  // Shares already fetched by the caller. The public profile pulls these in
  // the same round trip as the rest of its bundle, so this tab — the default
  // one — has content on its first frame instead of mounting, firing its own
  // request, and showing a spinner after the profile had already loaded.
  initialShares?: Share[];
  // Written with this tab's own loadMoreFeed while feed mode + active are
  // both true, cleared (`null`) otherwise — see this file's own top
  // comment and profile/index.tsx's for the full mechanism.
  nearBottomRef?: React.MutableRefObject<(() => void) | null>;
}

function ProfileSharingsTab({ userId = "me", basePath = "/profile", active = true, initialShares, nearBottomRef }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [shares, setShares] = useState<Share[]>(initialShares ?? []);
  const [total, setTotal] = useState(initialShares?.length ?? 0);
  const [loading, setLoading] = useState(!initialShares);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  // Category filter — empty means unfiltered (every category shows), same
  // "nothing selected = no restriction" convention the scope toggle
  // elsewhere in this app doesn't need but a genuine multi-select does.
  const [selectedTypes, setSelectedTypes] = useState<Set<ShareType>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const typesParam = selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined;
  const toggleTypeFilter = (type: ShareType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  // Pre-seeded shares count as freshly fetched — they came from the caller's
  // own request moments ago, so the revalidation below shouldn't immediately
  // repeat it.
  const lastFetchedRef = useRef(initialShares ? Date.now() : 0);

  // ---- Feed mode's own state (separate from the grid's capped preview) ----
  const [feedShares, setFeedShares] = useState<Share[]>([]);
  const [feedPage, setFeedPage] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const feedHasMore = feedShares.length < total;

  // Measured off the grid's own onLayout rather than assumed from
  // useWindowDimensions — the grid's actual available width can end up
  // narrower than the full device width depending on where this tab is
  // mounted, and computing tile size from a too-wide assumption is what
  // silently drops the row from 3 tiles to 2 (the 3rd tile no longer fits
  // in the real space, so it wraps, leaving a gap on the right instead of a
  // symmetric row). Starts from the screenWidth-based estimate so the very
  // first frame isn't 0-width, then locks onto the real measurement.
  const [gridWidth, setGridWidth] = useState(screenWidth);
  const handleGridLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    setGridWidth((prev) => (prev === width ? prev : width));
  };
  const tileSize = (gridWidth - SHARINGS_PADDING * 2 - SHARINGS_GAP * (SHARINGS_COLUMNS - 1)) / SHARINGS_COLUMNS;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // `position:"relative"` — the filter dropdown below anchors to this
        // row via `position:"absolute"`, not a separate Modal (direct ask:
        // it should drop down from right under the filter icon, not cover
        // the screen the way a bottom-sheet does).
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SHARINGS_PADDING,
          paddingTop: 8,
          position: "relative",
        },
        // Bare icon now, no button/pill background — direct ask ("sembolü
        // buton içine almana gerek yok"). Moved here from the row's end
        // (where the count label used to sit, now removed) — the filter
        // button below took its old end-of-row slot.
        viewToggle: { padding: 4 },
        filterButton: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        filterButtonActive: { borderColor: colors.primary },
        // Anchored dropdown, not a bottom-sheet Modal — direct ask ("bu
        // sembolün hemen altından... yüklenecek"). Right-aligned under the
        // filter button, same icon-circle + label row language as
        // PostComposeMenu.tsx/ShareOptionsMenu.tsx ("o shares sayfasındaki
        // gibi buton tasarımında") but a genuine multi-select list, not a
        // tap-and-close dispatcher: a row toggles its own membership and
        // the panel stays open so several can be picked in one visit.
        filterPanel: {
          position: "absolute",
          top: 44,
          right: SHARINGS_PADDING,
          backgroundColor: colors.base200,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 6,
          minWidth: 190,
          zIndex: 20,
          elevation: 6,
        },
        filterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
        filterIconWrap: {
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
        },
        filterLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.baseContent },
        grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: SHARINGS_PADDING, paddingTop: 8 },
        feedList: { paddingHorizontal: 0, paddingTop: 12, gap: 16 },
        feedFooter: { paddingVertical: 20, alignItems: "center" },
        // Horizontal inset matches the feed FlatList's own 16px padding
        // (SharesFeedSection.tsx's `list` style) so ShareCard's full-bleed
        // poster (negative-margined by that same 16px) lines up correctly
        // in both contexts.
        modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 20 },
        modalContent: { maxHeight: "85%" },
        modalHeader: { flexDirection: "row", justifyContent: "flex-end", paddingBottom: 8 },
        modalClose: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  const load = useCallback(
    (withSpinner: boolean) => {
      if (withSpinner) setLoading(true);
      let cancelled = false;
      getUserShares(userId, 1, SHARES_PREVIEW_LIMIT, selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined)
        .then((res) => {
          if (cancelled) return;
          setShares(res.items);
          setTotal(res.total);
          lastFetchedRef.current = Date.now();
        })
        .finally(() => {
          if (!cancelled && withSpinner) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [userId, selectedTypes]
  );

  // Skipped entirely when the caller handed us shares: there's nothing to
  // wait for, and the revalidate-on-active effect below keeps them current.
  const seededRef = useRef(Boolean(initialShares));
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      return;
    }
    return load(true);
  }, [load]);

  // This tab stays mounted once visited (ProfileCategoryTabs keeps it alive
  // so switching back is instant), which means the one fetch above would
  // otherwise be the only one for the whole session — a share posted in the
  // meantime would never show up here. Revalidating when the tab is brought
  // back gives the freshness the old remount-every-time behaviour had, minus
  // its cost: no spinner and no cleared list, because there's already
  // something correct on screen to keep showing while the request runs.
  useEffect(() => {
    if (!active) return;
    if (Date.now() - lastFetchedRef.current < REVALIDATE_TTL_MS) return;
    return load(false);
  }, [active, load]);

  // ---- Feed mode ------------------------------------------------------

  const loadFeedFirstPage = useCallback(() => {
    setFeedLoading(true);
    getUserShares(userId, 1, FEED_PAGE_LIMIT, selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined)
      .then((res) => {
        setFeedShares(res.items);
        setTotal(res.total);
        setFeedPage(1);
      })
      .finally(() => setFeedLoading(false));
  }, [userId, selectedTypes]);

  // A fresh closure every time feedPage/userId/selectedTypes change —
  // nearBottomRef's own effect below re-registers this exact function
  // whenever its deps (including this one) change, so the ref the parent's
  // ScrollView calls always fetches the correct next page for the CURRENT
  // filter, never a stale one.
  const loadMoreFeed = useCallback(() => {
    setFeedLoadingMore(true);
    const nextPage = feedPage + 1;
    getUserShares(userId, nextPage, FEED_PAGE_LIMIT, selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined)
      .then((res) => {
        setFeedShares((prev) => {
          const existingIds = new Set(prev.map((s) => s._id));
          return [...prev, ...res.items.filter((s) => !existingIds.has(s._id))];
        });
        setTotal(res.total);
        setFeedPage(nextPage);
      })
      .finally(() => setFeedLoadingMore(false));
  }, [userId, feedPage, selectedTypes]);

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "grid" ? "feed" : "grid";
      if (next === "feed" && feedPage === 0) loadFeedFirstPage();
      return next;
    });
  };

  // Changing the category filter invalidates whatever feed page(s) were
  // already loaded under the OLD filter — real bug otherwise: switching to
  // feed mode later would skip refetching (toggleViewMode's own
  // `feedPage === 0` guard), silently showing stale results, or — worse,
  // if already IN feed mode — leaving the currently-visible list mismatched
  // with the newly-selected categories. Refetches immediately when feed
  // mode is the one actually on screen; otherwise just resets so the next
  // entry into feed mode fetches fresh, same as this tab's own first-ever
  // visit.
  const isFirstTypesEffect = useRef(true);
  useEffect(() => {
    if (isFirstTypesEffect.current) {
      isFirstTypesEffect.current = false;
      return;
    }
    setFeedShares([]);
    setFeedPage(0);
    if (viewMode === "feed") loadFeedFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes]);

  // Registers/clears this tab's own loadMoreFeed into the parent screen's
  // shared ref — only while feed mode is the one actually on screen, so a
  // scroll-near-bottom anywhere else on the profile (Favorites, CineGraph,
  // or this same tab still in grid mode) never triggers a fetch meant for
  // a completely different view.
  useEffect(() => {
    if (!nearBottomRef) return;
    nearBottomRef.current = viewMode === "feed" && active && feedHasMore && !feedLoadingMore ? loadMoreFeed : null;
    return () => {
      if (nearBottomRef) nearBottomRef.current = null;
    };
  }, [nearBottomRef, viewMode, active, feedHasMore, feedLoadingMore, loadMoreFeed]);

  const handleToggleLike = async (shareId: string) => {
    const prevShares = shares;
    const prevFeedShares = feedShares;
    const flip = (s: Share) => ({ ...s, liked: !s.liked, likeCount: s.liked ? Math.max(0, s.likeCount - 1) : s.likeCount + 1 });
    setShares((cur) => cur.map((s) => (s._id === shareId ? flip(s) : s)));
    setFeedShares((cur) => cur.map((s) => (s._id === shareId ? flip(s) : s)));
    try {
      await toggleShareLike(shareId);
    } catch {
      setShares(prevShares);
      setFeedShares(prevFeedShares);
    }
  };

  const selectedShare = shares.find((s) => s._id === selectedShareId) ?? null;
  const hasActiveFilter = selectedTypes.size > 0;

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />;
  }

  return (
    <View>
      {/* Visible whenever there's real content OR a filter is active — not
          just `shares.length > 0` (the original gate): filtering down to
          zero results must never hide the filter button itself, or there'd
          be no way back to "All" once you're stuck at an empty filtered
          view. */}
      {(shares.length > 0 || hasActiveFilter) && (
        <View style={styles.headerRow}>
          {/* Swapped ends with the filter button below, direct ask — this
              used to sit on the right with a "{{count}} shares" label on
              the left, which is now gone entirely. */}
          <Pressable
            style={styles.viewToggle}
            onPress={toggleViewMode}
            accessibilityLabel={viewMode === "grid" ? t("Switch to feed view") : t("Switch to grid view")}
          >
            <Ionicons name={viewMode === "grid" ? "grid-outline" : "reorder-three-outline"} size={16} color={colors.baseContent} />
          </Pressable>
          <Pressable
            style={[styles.filterButton, hasActiveFilter && styles.filterButtonActive]}
            onPress={() => setFilterOpen((v) => !v)}
            accessibilityLabel={t("Filter by category")}
          >
            <Ionicons name="filter" size={15} color={hasActiveFilter ? colors.primary : colors.baseContent} />
          </Pressable>

          {filterOpen && (
            <View style={styles.filterPanel}>
              {FILTER_CATEGORIES.map((type) => {
                const meta = typeMeta(type, colors, t);
                const isSelected = selectedTypes.has(type);
                return (
                  <Pressable key={type} style={styles.filterRow} onPress={() => toggleTypeFilter(type)}>
                    <View style={[styles.filterIconWrap, { backgroundColor: `${meta.color}26` }]}>
                      <Ionicons name={meta.icon} size={13} color={meta.color} />
                    </View>
                    <Text style={styles.filterLabel}>{meta.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {shares.length === 0 ? (
        <Text style={{ textAlign: "center", color: colors.placeholder, marginTop: 24 }}>
          {hasActiveFilter ? t("No shares in these categories.") : t("No shares yet.")}
        </Text>
      ) : viewMode === "grid" ? (
        <View style={styles.grid} onLayout={handleGridLayout}>
          {shares.map((share, index) => (
            <ShareGridTile
              key={share._id}
              share={share}
              size={tileSize}
              onPress={() => setSelectedShareId(share._id)}
              style={{
                marginRight: (index + 1) % SHARINGS_COLUMNS === 0 ? 0 : SHARINGS_GAP,
                marginBottom: SHARINGS_GAP,
              }}
            />
          ))}
        </View>
      ) : (
        <View style={styles.feedList}>
          {feedLoading && feedShares.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : (
            <>
              {feedShares.map((share) => (
                <ShareCard key={share._id} share={share} onToggleLike={handleToggleLike} basePath={basePath} />
              ))}
              {feedLoadingMore && (
                <View style={styles.feedFooter}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Direct ask: at the bottom of this tab. */}
      {shares.length > 0 && <AdBanner unitId={AD_UNIT_IDS.PROFILE_POSTS_BANNER} />}

      <Modal visible={!!selectedShare} transparent animationType="fade" onRequestClose={() => setSelectedShareId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Above the card, not over it: the card's own header carries the
                "..." menu at its top right, which this used to sit on top of. */}
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalClose}
                onPress={() => setSelectedShareId(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
              >
                <Ionicons name="close" size={19} color="#fff" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedShare && <ShareCard share={selectedShare} onToggleLike={handleToggleLike} basePath={basePath} />}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Memoized for the same reason as the CineGraph tab: it stays mounted after
// its first visit, and re-rendering its whole share grid on every unrelated
// profile-screen render would give back what keeping it mounted just saved.
export default memo(ProfileSharingsTab);
