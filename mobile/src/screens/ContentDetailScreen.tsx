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
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getMovieById, getSeriesById } from "../api/contentService";
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
import RatingDistributionChart from "../components/RatingDistributionChart";
import ReviewComposer from "../components/ReviewComposer";
import ReviewCard from "../components/ReviewCard";
import FavoritesModal from "../components/FavoritesModal";
import { useMyReview } from "../hooks/useMyReview";
import type { ContentType, CustomList, Movie, Review, Series } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

type ReviewTab = "friends" | "popular";

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
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: colors.base200,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontFamily: fonts.bold, color: colors.baseContent },
  meta: { color: colors.placeholder, marginBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 16,
    marginBottom: 4,
    color: colors.baseContent,
  },
  overview: { fontSize: 15, lineHeight: 22, color: colors.baseContent },
  error: { color: colors.error, fontSize: 16 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  toggleButton: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleButtonText: { fontFamily: fonts.medium, color: colors.primary },
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
  reviewTabRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 4 },
  reviewTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  reviewTabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  reviewTabText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 13 },
  reviewTabTextActive: { color: colors.primaryContent },
  reviewsEmpty: { textAlign: "center", color: colors.placeholder, marginTop: 20, marginBottom: 8 },
  loadMoreButton: { alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: colors.base200, borderRadius: 12, padding: 20, maxHeight: "70%" },
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [content, setContent] = useState<Movie | Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myRating, setMyRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);

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

  const { myReview, setMyReview } = useMyReview(id, user?._id);
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("friends");
  const [friendsReviews, setFriendsReviews] = useState<Review[]>([]);
  const [popularReviews, setPopularReviews] = useState<Review[]>([]);
  const [popularPage, setPopularPage] = useState(1);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [popularLoadingMore, setPopularLoadingMore] = useState(false);

  const title = content ? (type === "movie" ? (content as Movie).title : (content as Series).name) : "";

  useEffect(() => {
    navigation.setOptions({ title: title || "" });
  }, [title]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [item, rating, watchlist, toWatchList, allRatings] = await Promise.all([
          type === "movie" ? getMovieById(id) : getSeriesById(id),
          getMyRating(id),
          getWatchlist(),
          getToWatchList(),
          getAllRatingsForContent(id),
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
      const [friends, popular] = await Promise.all([
        getFriendsReviews(id),
        getContentReviews(id, { sort: "popular", page: 1, limit: 20 }),
      ]);
      setFriendsReviews(friends);
      setPopularReviews(popular.items);
      setPopularPage(1);
      setPopularHasMore(popular.pagination ? 1 < popular.pagination.pages : popular.items.length > 0);
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

  const loadMorePopular = async () => {
    if (popularLoadingMore || !popularHasMore) return;
    setPopularLoadingMore(true);
    try {
      const nextPage = popularPage + 1;
      const popular = await getContentReviews(id, { sort: "popular", page: nextPage, limit: 20 });
      setPopularReviews((prev) => [...prev, ...popular.items]);
      setPopularPage(nextPage);
      setPopularHasMore(popular.pagination ? nextPage < popular.pagination.pages : popular.items.length > 0);
    } finally {
      setPopularLoadingMore(false);
    }
  };

  const handleReviewSaved = (review: Review) => {
    setMyReview(review);
    loadReviews();
  };

  const handleReviewDeleted = (reviewId?: string) => {
    const deletedId = reviewId ?? myReview?._id;
    if (!deletedId) return;
    setMyReview(null);
    setFriendsReviews((prev) => prev.filter((r) => r._id !== deletedId));
    setPopularReviews((prev) => prev.filter((r) => r._id !== deletedId));
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
      setRatings((prev) => [...prev, value]);
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
              setRatings((prev) => [...prev, myRating]);
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
                setRatings((prev) => [...prev, myRating]);
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
  const activeReviews = activeReviewTab === "friends" ? friendsReviews : popularReviews;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {posterPath ? (
        <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
      ) : null}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {releaseDate?.slice(0, 4) || "—"}
        {content.vote_average ? `  ·  TMDB ★ ${content.vote_average.toFixed(1)}` : ""}
      </Text>

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
          style={[styles.toggleButton, inToWatchList && styles.toggleButtonActive]}
          onPress={toggleToWatch}
          disabled={toWatchBusy}
        >
          <Text style={[styles.toggleButtonText, inToWatchList && styles.toggleButtonTextActive]}>
            {toWatchBusy ? "..." : inToWatchList ? `🕓 ${t("In Watchlist")}` : `+ ${t("Watchlist")}`}
          </Text>
        </Pressable>
        <Pressable style={styles.listButton} onPress={openListModal}>
          <Ionicons name="list" size={18} color={colors.baseContent} />
          <Text style={styles.listButtonText}>{t("Add to List")}</Text>
        </Pressable>
        <Pressable style={styles.listButton} onPress={handleOpenFavorites}>
          <Ionicons name={isFavorite ? "star" : "star-outline"} size={18} color={colors.baseContent} />
          <Text style={styles.listButtonText}>
            {isFavorite ? t("Manage Favorites") : t("Add to Favorites")}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t("Your rating")}</Text>
      <StarRatingInput value={myRating} onChange={handleRate} disabled={savingRating} />

      <Text style={styles.sectionTitle}>{t("Rating Distribution")}</Text>
      <RatingDistributionChart ratings={ratings} />

      {overview ? (
        <>
          <Text style={styles.sectionTitle}>{t("Overview")}</Text>
          <Text style={styles.overview}>{overview}</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t("Your review")}</Text>
      <ReviewComposer
        contentId={id}
        contentType={type}
        myReview={myReview}
        onSaved={handleReviewSaved}
        onDeleted={() => handleReviewDeleted()}
      />

      <View style={styles.reviewTabRow}>
        <Pressable
          style={[styles.reviewTabButton, activeReviewTab === "friends" && styles.reviewTabButtonActive]}
          onPress={() => setActiveReviewTab("friends")}
        >
          <Text
            style={[styles.reviewTabText, activeReviewTab === "friends" && styles.reviewTabTextActive]}
          >
            {t("Friends")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.reviewTabButton, activeReviewTab === "popular" && styles.reviewTabButtonActive]}
          onPress={() => setActiveReviewTab("popular")}
        >
          <Text
            style={[styles.reviewTabText, activeReviewTab === "popular" && styles.reviewTabTextActive]}
          >
            {t("Popular")}
          </Text>
        </Pressable>
      </View>

      {activeReviews.length === 0 ? (
        <Text style={styles.reviewsEmpty}>
          {activeReviewTab === "friends"
            ? t("No friends have reviewed this yet.")
            : t("No reviews yet. Be the first!")}
        </Text>
      ) : (
        activeReviews.map((r) => (
          <ReviewCard key={r._id} review={r} currentUserId={user?._id} onDelete={handleReviewDeleted} />
        ))
      )}

      {activeReviewTab === "popular" && popularHasMore && popularReviews.length > 0 && (
        <Pressable style={styles.loadMoreButton} onPress={loadMorePopular} disabled={popularLoadingMore}>
          {popularLoadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>{t("Load more")}</Text>
          )}
        </Pressable>
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
    </ScrollView>
  );
}

