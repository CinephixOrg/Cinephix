import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getMovieById, getSeriesById, getContentStats, getWatchedByFriends } from "../api/contentService";
import type { ContentStats, WatchedByFriend } from "../api/contentService";
import { getAllRatingsForContent, getMyRating, rateContent } from "../api/ratingService";
import { addToWatchlist, getWatchlist, removeFromWatchlist } from "../api/watchlistService";
import { addToToWatchList, getToWatchList, removeFromToWatchList } from "../api/toWatchService";
import {
  addItem as addItemToList,
  createList,
  getMyLists,
  removeItem as removeItemFromList,
} from "../api/listService";
import { getContentReviews, getFriendsReviews } from "../api/reviewService";
import { getFavorites } from "../api/favoriteService";
import StarRatingInput from "../components/StarRatingInput";
import StarRatingDisplay from "../components/StarRatingDisplay";
import RatingDistributionChart from "../components/RatingDistributionChart";
import ReviewComposer from "../components/ReviewComposer";
import ReviewCard from "../components/ReviewCard";
import FavoritesModal from "../components/FavoritesModal";
import UserAvatar from "../components/UserAvatar";
import ShareOptionsMenu from "../components/ShareOptionsMenu";
import UserSharePickerModal from "../components/UserSharePickerModal";
import { getOrCreateConversation, sendRichMessage } from "../api/conversationService";
import { sendGroupRichMessage } from "../api/groupService";
import { createShare } from "../api/shareService";
import { useMyReview } from "../hooks/useMyReview";
import type { ContentType, CustomList, Movie, Review, Series } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const OVERVIEW_LINE_HEIGHT = 20; // matches styles.overview's lineHeight

// Rendered from a thin route file inside EACH tab that links to it
// (movies/content/[type]/[id].tsx, series/..., watchlist/..., lists/...),
// so it's nested in that tab's own Stack and back navigation (hardware,
// gesture, and the Stack's own header arrow — all automatic, no manual
// BackHandler override needed) correctly returns to wherever it was opened
// from, instead of bottom-tabs' default of jumping to the first tab.
export default function ContentDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { padding: 16, gap: 8, backgroundColor: colors.base100, flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.base100,
  },
  topRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  posterWrap: { width: "38%", position: "relative" },
  posterSmall: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: colors.base200,
  },
  // Circular, half-overlapping the poster's own bottom edge — the button's
  // own vertical center sits exactly on the poster's bottom border.
  giftButton: {
    position: "absolute",
    bottom: -18,
    left: "50%",
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.base100,
  },
  topRightCol: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.baseContent },
  year: { fontSize: 15, color: colors.placeholder },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginTop: 16,
    marginBottom: 4,
    color: colors.baseContent,
  },
  overview: { fontSize: 14, lineHeight: 20, color: colors.baseContent, marginBottom: 8 },
  error: { color: colors.error, fontSize: 16 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.base200,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  // A small tinted circle behind each icon — one distinct semantic color
  // per stat (info/secondary/warning/success, all real theme tokens, not
  // new hardcoded hex) rather than the flat baseContent icons every stat
  // shared before. Favorites reuses `warning` — the exact same gold this
  // screen's own "Add to Favorites" star icon below already uses, not a
  // fresh pick.
  statIconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, marginTop: 2 },
  statLabel: { fontSize: 11, color: colors.placeholder },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  // Same neutral look as listButton below now (border/text colors were the
  // one thing that made this row visually inconsistent — the first two
  // buttons had their own primary-tinted treatment the other four never
  // did). toggleButtonActive (the *filled* state once you've actually
  // rated/added it) is unchanged and already shared with listButton's own
  // active state elsewhere in this row.
  toggleButton: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
  toggleButtonTextActive: { color: colors.primaryContent },
  listButton: {
    width: "48%",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  listButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 16 },
  friendsBox: { backgroundColor: colors.base200, borderRadius: 12, padding: 12 },
  friendsRow: { flexGrow: 0 },
  friendCard: { alignItems: "center", width: 66, marginRight: 14, gap: 4 },
  friendName: { fontSize: 12, color: colors.baseContent, maxWidth: 66 },
  // Reviews' inline section header — title + "See all" leading to the
  // full ContentReviewsSection.tsx page, same titleRow/seeAll language
  // ContentRail.tsx's own rails already use elsewhere in this app.
  previewSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAllText: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
  reviewsEmpty: { textAlign: "center", color: colors.placeholder, marginTop: 12, marginBottom: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: colors.base200, borderRadius: 12, padding: 20, maxHeight: "70%" },
  reviewModalCard: { position: "relative" },
  modalCloseIcon: { position: "absolute", top: 12, right: 12, zIndex: 1 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, marginBottom: 12 },
  modalList: { flexGrow: 0 },
  modalEmpty: { color: colors.placeholder, textAlign: "center", marginVertical: 20 },
  modalListRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  modalListLabel: { flex: 1, color: colors.baseContent, fontSize: 15 },
  modalCreateRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  modalCreateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base100,
    borderRadius: 8,
    padding: 10,
    color: colors.baseContent,
  },
  modalCreateButton: {
    width: 44,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneButton: { alignItems: "center", marginTop: 16, paddingVertical: 8 },
  modalDoneText: { color: colors.secondary, fontFamily: fonts.medium },
}), [colors]);
  const { t } = useTranslation();
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  // This screen is duplicated into every tab (content/[type]/[id].tsx under
  // home/socials/watchlist/profile/search/to-watch/lists, plus
  // user/[id]/content/[type]/[id].tsx) with no basePath prop of its own —
  // it's never needed one before now, since it had no internal navigation
  // of its own. The Lists/Reviews stat buttons are its first, so rather
  // than thread a new prop through every one of those 8 thin re-export
  // files, this derives "which tab am I in" straight from the current URL:
  // `/home/content/movie/123` → `/home`, `/user/abc/content/...` → `/user/abc`.
  const pathname = usePathname();
  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "user" && segments[1]) return `/user/${segments[1]}`;
    return segments[0] ? `/${segments[0]}` : "/home";
  }, [pathname]);

  const [content, setContent] = useState<Movie | Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myRating, setMyRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);

  const [stats, setStats] = useState<ContentStats | null>(null);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  const [inToWatchList, setInToWatchList] = useState(false);
  const [toWatchBusy, setToWatchBusy] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false);

  const [listModalVisible, setListModalVisible] = useState(false);
  const [myLists, setMyLists] = useState<CustomList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listBusyId, setListBusyId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [posterHeight, setPosterHeight] = useState(0);
  const [titleRowHeight, setTitleRowHeight] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const [giftMenuVisible, setGiftMenuVisible] = useState(false);
  const [recommendPickerVisible, setRecommendPickerVisible] = useState(false);
  const [sendingRecommendation, setSendingRecommendation] = useState(false);
  const [sharingRecommendation, setSharingRecommendation] = useState(false);

  const { myReview, setMyReview } = useMyReview(id, user?._id);
  // Trimmed from a full Friends/Popular-tab-plus-pagination section down to
  // a small, tab-less preview once the Reviews stat button started leading
  // to a dedicated full page (ContentReviewsSection.tsx) showing this exact
  // same thing — keeping both the full tabbed/paginated version *and* the
  // stat-button link to an identical full page was genuine duplication.
  // Still fetches both (friends preferred, popular fills the rest) so the
  // couple of reviews shown here keep the same "people you follow first"
  // preference the old tabs implied by defaulting to the Friends tab.
  const [friendsReviews, setFriendsReviews] = useState<Review[]>([]);
  const [popularReviews, setPopularReviews] = useState<Review[]>([]);

  const [watchedByFriends, setWatchedByFriends] = useState<WatchedByFriend[]>([]);

  const title = content ? (type === "movie" ? (content as Movie).title : (content as Series).name) : "";

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [item, rating, watchlist, toWatchList, allRatings, lists] = await Promise.all([
          type === "movie" ? getMovieById(id) : getSeriesById(id),
          getMyRating(id),
          getWatchlist(),
          getToWatchList(),
          getAllRatingsForContent(id),
          getMyLists(),
        ]);
        setContent(item);
        if (rating) {
          setMyRating(rating.value);
          setRatingSaved(true);
        } else {
          setMyRating(0);
          setRatingSaved(false);
        }
        setInWatchlist(watchlist.some((w) => w.itemId === id && w.itemType === type));
        setInToWatchList(toWatchList.some((w) => w.itemId === id && w.itemType === type));
        setRatings(allRatings);
        setMyLists(lists);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load content."));
      } finally {
        setLoading(false);
      }
    })();
  }, [type, id]);

  // Fetched separately from the content/rating/watchlist load above — a
  // reviews-API hiccup shouldn't block viewing the poster/rating/watchlist,
  // so failures here just leave the arrays empty rather than setting the
  // screen's fatal `error` state.
  const loadReviews = useCallback(async () => {
    try {
      // limit:5 is plenty — this only ever needs to fill a 2-review
      // preview (friends first, popular fills the rest), no pagination
      // happens on this screen anymore.
      const [friends, popular] = await Promise.all([
        getFriendsReviews(id),
        getContentReviews(id, { sort: "popular", page: 1, limit: 5 }),
      ]);
      setFriendsReviews(friends);
      setPopularReviews(popular.items);
    } catch {
      // leave whatever was already loaded in place
    }
  }, [id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Also fetched separately from the main load, same reasoning as
  // loadReviews above — a favorites-API hiccup shouldn't block viewing the
  // poster/rating/watchlist.
  const loadFavoriteStatus = useCallback(async () => {
    if (!user?._id) return;
    try {
      const favorites = await getFavorites(user._id);
      if (favorites.isAuthorized) {
        const list = type === "movie" ? favorites.movies : favorites.series;
        setIsFavorite(list.some((it) => it._id === id));
      }
    } catch {
      // leave isFavorite as-is (defaults false) on failure
    }
  }, [id, type, user?._id]);

  useEffect(() => {
    loadFavoriteStatus();
  }, [loadFavoriteStatus]);

  // Re-fetches the authoritative rating distribution from the server rather
  // than guessing locally — a user can re-save their own rating multiple
  // times in one visit (the backend upserts, so there's still only one
  // Rating doc per user), and a naive local append would double-count every
  // re-save, inflating the chart. This can never drift from the truth.
  const refreshRatings = useCallback(async () => {
    try {
      setRatings(await getAllRatingsForContent(id));
    } catch {
      // leave whatever was already loaded in place
    }
  }, [id]);

  // Supplementary aggregate counts for the info-stats row — same
  // non-blocking-failure reasoning as loadReviews/loadFavoriteStatus above.
  const loadStats = useCallback(async () => {
    try {
      const contentStats = await getContentStats(type, id);
      setStats(contentStats);
    } catch {
      // leave stats null on failure; the row just shows 0s
    }
  }, [id, type]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Also non-blocking — who in my network has watched this, and their
  // rating if any.
  const loadWatchedByFriends = useCallback(async () => {
    try {
      const friends = await getWatchedByFriends(type, id);
      setWatchedByFriends(friends);
    } catch {
      // leave whatever was already loaded in place
    }
  }, [id, type]);

  useEffect(() => {
    loadWatchedByFriends();
  }, [loadWatchedByFriends]);

  const handleReviewSaved = (review: Review) => {
    setMyReview(review);
    loadReviews();
    setReviewModalVisible(false);
  };

  const handleReviewDeleted = (reviewId?: string) => {
    const deletedId = reviewId ?? myReview?._id;
    if (!deletedId) return;
    setMyReview(null);
    setFriendsReviews((prev) => prev.filter((r) => r._id !== deletedId));
    setPopularReviews((prev) => prev.filter((r) => r._id !== deletedId));
    setReviewModalVisible(false);
  };

  const handleRate = async (value: number) => {
    const previous = myRating;
    setMyRating(value);

    // Matches web's handleRatingChange exactly: a rating only gets persisted
    // (and thus counted in the distribution chart) once the item is on the
    // watched list or already a favorite — otherwise it's held in local
    // state only and quietly discarded if the user navigates away without
    // ever adding it. toggleWatchlist's add-branch below saves it then.
    if (!inWatchlist && !isFavorite) {
      showToast(t("Rating set locally. Add to Watched List to save."));
      return;
    }

    setSavingRating(true);
    try {
      await rateContent(id, type, value);
      setRatingSaved(true);
      refreshRatings();
    } catch (e) {
      setMyRating(previous);
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSavingRating(false);
    }
  };

  const toggleWatchlist = async () => {
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id, type);
        setInWatchlist(false);
        // Backend unconditionally strips this item from favorites when it
        // leaves the watched list (userWatchlistRoute.js's DELETE handler) —
        // an unwatched item can't be a favorite. Mirror that here so the
        // star icon doesn't go stale until the next full reload.
        setIsFavorite(false);
      } else {
        await addToWatchlist(id, type);
        setInWatchlist(true);
        // Mirrors web's handleAddToList: if a rating was chosen before this
        // item was ever on the watched list, it was held locally only
        // (handleRate's gate) — save it now that the invariant is satisfied.
        if (myRating > 0 && !ratingSaved) {
          rateContent(id, type, myRating)
            .then(() => {
              setRatingSaved(true);
              refreshRatings();
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      // leave state unchanged on failure
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setWatchlistBusy(false);
    }
  };

  // The Rate modal's own closing action — reuses toggleWatchlist's add
  // branch (never its remove branch: this only ever ADDS, tapping it while
  // already on the watched list is a no-op besides closing) rather than
  // duplicating the add-and-save-pending-rating logic a second time. The
  // standalone "Add to Watchedlist" button reads the same `inWatchlist`
  // state, so it updates to reflect this automatically — no separate sync
  // needed.
  const handleRateModalDone = async () => {
    if (!inWatchlist) {
      await toggleWatchlist();
    }
    setRateModalVisible(false);
  };

  const toggleToWatch = async () => {
    setToWatchBusy(true);
    try {
      if (inToWatchList) {
        await removeFromToWatchList(id, type);
        setInToWatchList(false);
      } else {
        await addToToWatchList(id, type);
        setInToWatchList(true);
      }
    } catch (e) {
      // leave state unchanged on failure
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setToWatchBusy(false);
    }
  };

  // Matches web's ContentDetailPage.jsx handleOpenFavModal exactly: firing
  // on button tap (not on the modal's eventual Save), optimistic, and
  // non-blocking — the modal opens immediately regardless of whether this
  // background add succeeds. An item can't be a favorite without being on
  // the watched list, so this pre-emptively satisfies that invariant for a
  // genuinely new item; already-watched items (the normal case for
  // "Manage Favorites" on an existing favorite) skip the call entirely.
  const handleOpenFavorites = () => {
    if (!inWatchlist) {
      setInWatchlist(true);
      addToWatchlist(id, type)
        .then(() => {
          if (myRating > 0 && !ratingSaved) {
            rateContent(id, type, myRating)
              .then(() => {
                setRatingSaved(true);
                refreshRatings();
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          setInWatchlist(false);
          showToast(t("Something went wrong. Please try again."));
        });
    }
    setFavoritesModalVisible(true);
  };

  const openListModal = async () => {
    setListModalVisible(true);
    setListsLoading(true);
    try {
      const lists = await getMyLists();
      setMyLists(lists);
    } catch (e) {
      // leave list empty on failure; modal shows nothing to pick
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setListsLoading(false);
    }
  };

  const toggleListMembership = async (list: CustomList) => {
    const inList = list.items.some((it) => it.itemId === id && it.itemType === type);
    setListBusyId(list._id);
    try {
      const updated = inList
        ? await removeItemFromList(list._id, id, type)
        : await addItemToList(list._id, id, type);
      setMyLists((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
    } catch (e) {
      // leave state unchanged on failure
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setListBusyId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    setCreatingList(true);
    try {
      const list = await createList({ name: newListName.trim() });
      const updated = await addItemToList(list._id, id, type);
      setMyLists((prev) => [updated, ...prev]);
      setNewListName("");
    } catch (e) {
      // leave input as-is on failure so the user can retry
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setCreatingList(false);
    }
  };

  if (loading) {
    return (
      <ActivityIndicator
        style={{ flex: 1, backgroundColor: colors.base100 }}
        size="large"
        color={colors.primary}
      />
    );
  }

  if (error || !content) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t("Content not found.")}</Text>
      </View>
    );
  }

  const posterPath = content.poster_path;
  const overview = content.overview;
  const releaseDate = type === "movie" ? (content as Movie).release_date : (content as Series).first_air_date;
  // Friends first (same preference the old Friends/Popular tabs implied by
  // defaulting to Friends), popular fills the rest, deduped in case a
  // review happens to appear in both — capped to 2, this is a preview now,
  // not the full list (that's ContentReviewsSection.tsx, one tap away).
  const previewReviews = (() => {
    const seen = new Set<string>();
    const merged: Review[] = [];
    for (const r of [...friendsReviews, ...popularReviews]) {
      if (seen.has(r._id)) continue;
      seen.add(r._id);
      merged.push(r);
      if (merged.length === 2) break;
    }
    return merged;
  })();
  const inAnyList = myLists.some((l) => l.items.some((it) => it.itemId === id && it.itemType === type));
  const overviewLines =
    !overviewExpanded && posterHeight > 0
      ? Math.max(1, Math.floor((posterHeight - titleRowHeight) / OVERVIEW_LINE_HEIGHT))
      : undefined;

  // Shortcut recommend flow — skips socials/messages/recommend.tsx's search
  // step entirely since we're already viewing the content to recommend.
  const handleSendRecommendation = async (userIds: string[], groupIds: string[]) => {
    if (!user) return;
    setSendingRecommendation(true);
    try {
      const text = t("User recommends you", {
        user: user.username,
        title,
        type: t(type === "movie" ? "movie_acc" : "series_acc"),
      });
      const contentData = {
        title,
        posterUrl: posterPath ?? undefined,
        genres: [] as string[],
        releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : undefined,
        overview,
        rating: content?.vote_average,
      };
      await Promise.all([
        ...userIds.map(async (uid) => {
          const conv = await getOrCreateConversation(uid);
          await sendRichMessage(conv._id, { text, type: "recommendation", contentId: id, contentType: type, contentData });
        }),
        ...groupIds.map((gid) =>
          sendGroupRichMessage(gid, { text, type: "recommendation", contentId: id, contentType: type, contentData })
        ),
      ]);
      setRecommendPickerVisible(false);
      showToast(t("Recommendation sent"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSendingRecommendation(false);
    }
  };

  const handleShareRecommendationToMedia = async () => {
    setSharingRecommendation(true);
    try {
      await createShare({ type: "recommendation", contentId: id, contentType: type });
      setGiftMenuVisible(false);
      showToast(t("Shared to Medya"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingRecommendation(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.posterWrap}>
          {posterPath ? (
            <Image
              source={{ uri: `${POSTER_BASE}${posterPath}` }}
              style={styles.posterSmall}
              onLayout={(e) => setPosterHeight(e.nativeEvent.layout.height)}
            />
          ) : (
            <View style={styles.posterSmall} onLayout={(e) => setPosterHeight(e.nativeEvent.layout.height)} />
          )}
          <Pressable
            style={styles.giftButton}
            onPress={() => setGiftMenuVisible(true)}
            accessibilityLabel={t("Recommend")}
            hitSlop={6}
          >
            <Ionicons name="gift-outline" size={18} color={colors.primaryContent} />
          </Pressable>
        </View>
        <View style={styles.topRightCol}>
          <View style={styles.titleRow} onLayout={(e) => setTitleRowHeight(e.nativeEvent.layout.height)}>
            <Text style={styles.title}>{title}</Text>
            {releaseDate?.slice(0, 4) ? <Text style={styles.year}>{releaseDate.slice(0, 4)}</Text> : null}
          </View>
          {overview ? (
            <Pressable onPress={() => setOverviewExpanded((e) => !e)}>
              <Text style={styles.overview} numberOfLines={overviewLines} ellipsizeMode="tail">
                {overview}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <RatingDistributionChart ratings={ratings} />

      <View style={styles.statsRow}>
        <Pressable style={styles.statItem} onPress={() => router.push(`${basePath}/content/${type}/${id}/watched` as any)}>
          <View style={[styles.statIconBadge, { backgroundColor: `${colors.info}1F` }]}>
            <Ionicons name="eye-outline" size={20} color={colors.info} />
          </View>
          <Text style={styles.statValue}>{stats?.watchedCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Watched")}</Text>
        </Pressable>
        <Pressable style={styles.statItem} onPress={() => router.push(`${basePath}/content/${type}/${id}/reviews` as any)}>
          <View style={[styles.statIconBadge, { backgroundColor: `${colors.secondary}1F` }]}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.secondary} />
          </View>
          <Text style={styles.statValue}>{stats?.reviewCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Reviews")}</Text>
        </Pressable>
        <Pressable style={styles.statItem} onPress={() => router.push(`${basePath}/content/${type}/${id}/favorited` as any)}>
          <View style={[styles.statIconBadge, { backgroundColor: `${colors.warning}1F` }]}>
            <Ionicons name="star" size={20} color={colors.warning} />
          </View>
          <Text style={styles.statValue}>{stats?.favoriteCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Favorites")}</Text>
        </Pressable>
        <Pressable style={styles.statItem} onPress={() => router.push(`${basePath}/content/${type}/${id}/lists` as any)}>
          <View style={[styles.statIconBadge, { backgroundColor: `${colors.success}1F` }]}>
            <Ionicons name="list" size={20} color={colors.success} />
          </View>
          <Text style={styles.statValue}>{stats?.listCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("Lists")}</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.toggleButton, inWatchlist && styles.toggleButtonActive]}
          onPress={toggleWatchlist}
          disabled={watchlistBusy}
        >
          <Text style={[styles.toggleButtonText, inWatchlist && styles.toggleButtonTextActive]}>
            {watchlistBusy ? "..." : inWatchlist ? `✓ ${t("Added to List")}` : `+ ${t("Add to Watchedlist")}`}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, myRating > 0 && styles.toggleButtonActive]}
          onPress={() => setRateModalVisible(true)}
        >
          <Text style={[styles.toggleButtonText, myRating > 0 && styles.toggleButtonTextActive]}>
            {myRating > 0 ? `${(myRating / 2).toFixed(1)} ` : t("Rate")}
            {myRating > 0 && (
              <Text style={[styles.toggleButtonText, styles.toggleButtonTextActive]}>★</Text>
            )}
          </Text>
        </Pressable>
        <Pressable style={[styles.listButton, inAnyList && styles.toggleButtonActive]} onPress={openListModal}>
          <Ionicons name="list" size={18} color={inAnyList ? colors.primaryContent : colors.baseContent} />
          <Text style={[styles.listButtonText, inAnyList && styles.toggleButtonTextActive]}>
            {inAnyList ? t("Manage List") : t("Add to List")}
          </Text>
        </Pressable>
        <Pressable style={[styles.listButton, isFavorite && styles.toggleButtonActive]} onPress={handleOpenFavorites}>
          <Ionicons name={isFavorite ? "star" : "star-outline"} size={18} color={colors.warning} />
          <Text style={[styles.listButtonText, isFavorite && styles.toggleButtonTextActive]}>
            {isFavorite ? t("Manage Favorites") : t("Add to Favorites")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.listButton, inToWatchList && styles.toggleButtonActive]}
          onPress={toggleToWatch}
          disabled={toWatchBusy}
        >
          <Ionicons
            name={inToWatchList ? "time" : "time-outline"}
            size={18}
            color={inToWatchList ? colors.primaryContent : colors.baseContent}
          />
          <Text style={[styles.listButtonText, inToWatchList && styles.toggleButtonTextActive]}>
            {inToWatchList ? t("In Watchlist") : t("Watchlist")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.listButton, myReview != null && styles.toggleButtonActive]}
          onPress={() => setReviewModalVisible(true)}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={myReview != null ? colors.primaryContent : colors.baseContent}
          />
          <Text style={[styles.listButtonText, myReview != null && styles.toggleButtonTextActive]}>
            {myReview ? t("Edit Review") : t("Add Review")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t("Watched by Friends")}</Text>
      <View style={styles.friendsBox}>
        {watchedByFriends.length === 0 ? (
          <Text style={styles.reviewsEmpty}>{t("No friends have watched this yet.")}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsRow}>
            {watchedByFriends.map((friend) => (
              <View key={friend._id} style={styles.friendCard}>
                <UserAvatar
                  userId={friend._id}
                  username={friend.username}
                  profilePicUrl={friend.profile_pic_url}
                  size={48}
                />
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.username}
                </Text>
                <StarRatingDisplay value={friend.rating} size={12} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.divider} />

      {/* Trimmed preview (was a full Friends/Popular-tab-plus-pagination
          section) — "See all" leads to ContentReviewsSection.tsx, the
          exact same tabbed/paginated experience this section used to be
          inline, so keeping both here would just be duplication. */}
      <View style={styles.previewSectionHeader}>
        <Text style={styles.sectionTitle}>{t("Reviews")}</Text>
        <Pressable onPress={() => router.push(`${basePath}/content/${type}/${id}/reviews` as any)} hitSlop={8}>
          <Text style={styles.seeAllText}>{t("See all")}</Text>
        </Pressable>
      </View>

      {previewReviews.length === 0 ? (
        <Text style={styles.reviewsEmpty}>{t("No reviews yet. Be the first!")}</Text>
      ) : (
        previewReviews.map((r) => <ReviewCard key={r._id} review={r} />)
      )}

      <Modal visible={listModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("Add to List")}</Text>

            {listsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={myLists}
                keyExtractor={(l) => l._id}
                style={styles.modalList}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>{t("You haven't created any lists yet.")}</Text>
                }
                renderItem={({ item }) => {
                  const inList = item.items.some((it) => it.itemId === id && it.itemType === type);
                  return (
                    <Pressable
                      style={styles.modalListRow}
                      onPress={() => toggleListMembership(item)}
                      disabled={listBusyId === item._id}
                    >
                      <Ionicons
                        name={inList ? "checkbox" : "square-outline"}
                        size={20}
                        color={inList ? colors.primary : colors.placeholder}
                      />
                      <Text style={styles.modalListLabel}>{item.name}</Text>
                      {listBusyId === item._id && <ActivityIndicator size="small" color={colors.primary} />}
                    </Pressable>
                  );
                }}
              />
            )}

            <View style={styles.modalCreateRow}>
              <TextInput
                style={styles.modalCreateInput}
                placeholder={t("Name")}
                placeholderTextColor={colors.placeholder}
                value={newListName}
                onChangeText={setNewListName}
              />
              <Pressable
                style={styles.modalCreateButton}
                onPress={handleCreateAndAdd}
                disabled={creatingList || !newListName.trim()}
              >
                {creatingList ? (
                  <ActivityIndicator size="small" color={colors.primaryContent} />
                ) : (
                  <Ionicons name="add" size={20} color={colors.primaryContent} />
                )}
              </Pressable>
            </View>

            <Pressable style={styles.modalDoneButton} onPress={() => setListModalVisible(false)}>
              <Text style={styles.modalDoneText}>{t("Done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={rateModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("Your rating")}</Text>
            <StarRatingInput value={myRating} onChange={handleRate} disabled={savingRating} size={52} />
            <Pressable style={styles.modalDoneButton} onPress={handleRateModalDone} disabled={watchlistBusy}>
              <Text style={styles.modalDoneText}>{inWatchlist ? t("Done") : t("Add to Watchedlist")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.reviewModalCard]}>
            <Pressable style={styles.modalCloseIcon} onPress={() => setReviewModalVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.placeholder} />
            </Pressable>
            <Text style={styles.modalTitle}>{myReview ? t("Edit Review") : t("Add Review")}</Text>
            <ReviewComposer
              contentId={id}
              contentType={type}
              myReview={myReview}
              onSaved={handleReviewSaved}
              onDeleted={() => handleReviewDeleted()}
            />
          </View>
        </View>
      </Modal>

      {user && (
        <FavoritesModal
          visible={favoritesModalVisible}
          onClose={() => setFavoritesModalVisible(false)}
          type={type}
          currentItem={{ id, title, posterPath: content.poster_path }}
          myUserId={user._id}
          onSaved={setIsFavorite}
        />
      )}

      <ShareOptionsMenu
        visible={giftMenuVisible}
        onClose={() => setGiftMenuVisible(false)}
        onSendToPeople={() => {
          setGiftMenuVisible(false);
          setRecommendPickerVisible(true);
        }}
        onShareToMedia={handleShareRecommendationToMedia}
        sharing={sharingRecommendation}
      />

      <UserSharePickerModal
        visible={recommendPickerVisible}
        title={t("Recommend Movie/Series")}
        onClose={() => setRecommendPickerVisible(false)}
        sending={sendingRecommendation}
        onConfirm={handleSendRecommendation}
        allowGroups
      />
    </ScrollView>
  );
}
