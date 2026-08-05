import { useEffect, useState } from "react";
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
import { getMovieById, getSeriesById } from "../api/contentService";
import { getMyRating, rateContent } from "../api/ratingService";
import { addToWatchlist, getWatchlist, removeFromWatchlist } from "../api/watchlistService";
import {
  addItem as addItemToList,
  createList,
  getMyLists,
  removeItem as removeItemFromList,
} from "../api/listService";
import StarRatingInput from "../components/StarRatingInput";
import type { ContentType, CustomList, Movie, Series } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// Rendered from a thin route file inside EACH tab that links to it
// (movies/content/[type]/[id].tsx, series/..., watchlist/..., lists/...),
// so it's nested in that tab's own Stack and back navigation (hardware,
// gesture, and the Stack's own header arrow — all automatic, no manual
// BackHandler override needed) correctly returns to wherever it was opened
// from, instead of bottom-tabs' default of jumping to the first tab.
export default function ContentDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  const navigation = useNavigation();

  const [content, setContent] = useState<Movie | Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myRating, setMyRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  const [listModalVisible, setListModalVisible] = useState(false);
  const [myLists, setMyLists] = useState<CustomList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listBusyId, setListBusyId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const title = content ? (type === "movie" ? (content as Movie).title : (content as Series).name) : "";

  useEffect(() => {
    navigation.setOptions({ title: title || "" });
  }, [title]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [item, rating, watchlist] = await Promise.all([
          type === "movie" ? getMovieById(id) : getSeriesById(id),
          getMyRating(id),
          getWatchlist(),
        ]);
        setContent(item);
        if (rating) setMyRating(rating.value);
        setInWatchlist(watchlist.some((w) => w.itemId === id && w.itemType === type));
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load content.");
      } finally {
        setLoading(false);
      }
    })();
  }, [type, id]);

  const handleRate = async (value: number) => {
    const previous = myRating;
    setMyRating(value);
    setSavingRating(true);
    try {
      await rateContent(id, type, value);
    } catch (e) {
      setMyRating(previous);
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
      } else {
        await addToWatchlist(id, type);
        setInWatchlist(true);
      }
    } catch (e) {
      // leave state unchanged on failure
    } finally {
      setWatchlistBusy(false);
    }
  };

  const openListModal = async () => {
    setListModalVisible(true);
    setListsLoading(true);
    try {
      const lists = await getMyLists();
      setMyLists(lists);
    } catch (e) {
      // leave list empty on failure; modal shows nothing to pick
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
        <Text style={styles.error}>{error || "Content not found."}</Text>
      </View>
    );
  }

  const posterPath = content.poster_path;
  const overview = content.overview;
  const releaseDate = type === "movie" ? (content as Movie).release_date : (content as Series).first_air_date;

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
          style={[styles.watchlistButton, inWatchlist && styles.watchlistButtonActive]}
          onPress={toggleWatchlist}
          disabled={watchlistBusy}
        >
          <Text style={[styles.watchlistButtonText, inWatchlist && styles.watchlistButtonTextActive]}>
            {watchlistBusy ? "..." : inWatchlist ? "✓ In Watchlist" : "+ Add to Watchlist"}
          </Text>
        </Pressable>
        <Pressable style={styles.listButton} onPress={openListModal}>
          <Ionicons name="list" size={18} color={colors.baseContent} />
          <Text style={styles.listButtonText}>Add to List</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Your rating</Text>
      <StarRatingInput value={myRating} onChange={handleRate} disabled={savingRating} />

      {overview ? (
        <>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overview}>{overview}</Text>
        </>
      ) : null}

      <Modal visible={listModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add to List</Text>

            {listsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={myLists}
                keyExtractor={(l) => l._id}
                style={styles.modalList}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>You don't have any lists yet.</Text>
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
                placeholder="New list name"
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
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  watchlistButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  watchlistButtonActive: { backgroundColor: colors.primary },
  watchlistButtonText: { fontFamily: fonts.medium, color: colors.primary },
  watchlistButtonTextActive: { color: colors.primaryContent },
  listButton: {
    flex: 1,
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
});
