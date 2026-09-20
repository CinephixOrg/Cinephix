import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  LayoutAnimation,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { myListsCache } from "../api/myListsCache";
import { invalidatePublicProfile } from "../api/publicProfileCache";
import DiscoverListCard from "../components/DiscoverListCard";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import CollectionToolbar from "../components/collection/CollectionToolbar";
import CollectionUndoBar from "../components/collection/CollectionUndoBar";
import { CollectionStateView } from "../components/collection/CollectionStates";
import ListCardSkeleton from "../components/lists/ListCardSkeleton";
import { buildNamedIndex, searchNamed } from "../utils/collectionQuery";
import { fonts } from "../theme/typography";
import type { CustomList, DiscoverListItem } from "../types";

const PADDING_X = 16;
const LIST_PADDING_BOTTOM = 110;
const UNDO_MS = 4000;
const SKELETON_CARDS = [0, 1, 2, 3];

// A deleted card fades out while the cards below slide up into its place, and
// an undone one fades back in as they make room — native layout animations,
// since each card's height depends on its own content.
const REFLOW = LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

type Status = "loading" | "ready" | "error";
type Owner = DiscoverListItem["owner"];

// DiscoverListCard, the Popular Lists card, takes its owner as a user rather
// than an id. Cards are cached per list object, so a list that didn't change
// between renders keeps its card and its row skips re-rendering.
const cards = new WeakMap<CustomList, { owner: Owner; card: DiscoverListItem }>();

function cardFor(list: CustomList, owner: Owner): DiscoverListItem {
  const cached = cards.get(list);
  if (cached && cached.owner === owner) return cached.card;
  const card: DiscoverListItem = {
    _id: list._id,
    owner,
    name: list.name,
    description: list.description,
    isPublic: list.isPublic,
    items: list.items,
    previewItems: list.previewItems ?? [],
    likeCount: list.likeCount ?? 0,
    views: list.views ?? 0,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
  cards.set(list, { owner, card });
  return card;
}

const nameOf = (card: DiscoverListItem) => card.name;
const keyOf = (card: DiscoverListItem) => card._id;

const rowStyles = StyleSheet.create({
  // The card's own bottom margin (12) stays outside the wash.
  editLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 12 },
  wash: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(220,38,38,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});

interface RowProps {
  card: DiscoverListItem;
  editing: boolean;
  editProgress: Animated.Value;
  onOpen: (card: DiscoverListItem) => void;
  onRemove: (card: DiscoverListItem) => void;
  deleteLabel: string;
}

// One list: the Popular Lists card, with the edit wash on top. In edit mode
// the whole card is the delete target, the same large tap target as the title
// grids, and the card underneath can't be opened or liked by accident.
const MyListRow = memo(function MyListRow({ card, editing, editProgress, onOpen, onRemove, deleteLabel }: RowProps) {
  const open = useCallback(() => onOpen(card), [onOpen, card]);
  const remove = useCallback(() => onRemove(card), [onRemove, card]);
  return (
    <View>
      <DiscoverListCard list={card} onPress={open} basePath="/lists" />
      <Animated.View pointerEvents={editing ? "auto" : "none"} style={[rowStyles.editLayer, { opacity: editProgress }]}>
        <Pressable
          onPress={remove}
          accessibilityRole="button"
          accessibilityLabel={`${deleteLabel}, ${card.name}`}
          style={({ pressed }) => [rowStyles.wash, pressed && rowStyles.pressed]}
        >
          <View style={rowStyles.removeButton}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});

// The signed-in user's custom lists, shown the way Discover's Popular Lists
// shows lists, with the Watched List and Watchlist's search and edit mode: a
// search that runs on the device, and an edit mode where a tap deletes a list
// behind an undo window.
//
// The lists come from myListsCache, so a revisit renders them on the first
// frame and refreshes underneath, and typing never waits on the network.
function MyListsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refresh: refreshProfile } = useProfile();
  const { showToast } = useToast();
  const router = useRouter();

  const userId = user?._id ?? "";
  const [lists, setLists] = useState<CustomList[]>(() => (userId ? myListsCache.getCached(userId) : null) ?? []);
  const [status, setStatus] = useState<Status>(() => (userId && myListsCache.getCached(userId) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [undoList, setUndoList] = useState<CustomList | null>(null);

  useEffect(() => myListsCache.subscribe(setLists), []);

  // ---- Loading ------------------------------------------------------------

  // Read through refs so every callback below stays stable: a focus effect
  // that re-ran whenever a toast appeared would commit a pending delete early.
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;
  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    return myListsCache
      .load(userId)
      .then(() => setStatus("ready"))
      .catch(() => {
        // Over lists already on screen, a failed refresh is only worth a toast.
        if (myListsCache.getCached(userId)) toastRef.current(tRef.current("Failed to load lists."));
        else setStatus("error");
      });
  }, [userId]);

  const retry = useCallback(() => {
    setStatus("loading");
    load();
  }, [load]);

  // ---- Delete with undo ---------------------------------------------------

  const pendingRef = useRef<{ list: CustomList; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = useCallback(
    (list: CustomList) => {
      myListsCache
        .commitRemoval(list)
        .then(() => {
          // The profile's list count and the public view of this profile both
          // include the list that's gone.
          refreshProfileRef.current({ force: true });
          invalidatePublicProfile(userId);
        })
        .catch((e: any) => {
          LayoutAnimation.configureNext(REFLOW);
          toastRef.current(e?.response?.data?.message || tRef.current("Failed to delete list."));
        });
    },
    [userId]
  );

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoList(null);
    commit(pending.list);
  }, [commit]);

  // The card leaves the page on this call (hide() updates the cache
  // synchronously) and the rest slide up. The delete itself waits out the undo
  // window: a list can hold a lot, and a mis-tap shouldn't cost it.
  const handleRemove = useCallback(
    (card: DiscoverListItem) => {
      if (pendingRef.current?.list._id === card._id) return;
      // One pending delete at a time: a second one commits the first.
      flushPending();
      LayoutAnimation.configureNext(REFLOW);
      const list = myListsCache.hide(card._id);
      if (!list) return;
      const timer = setTimeout(() => {
        if (pendingRef.current?.list !== list) return;
        pendingRef.current = null;
        setUndoList(null);
        commit(list);
      }, UNDO_MS);
      pendingRef.current = { list, timer };
      setUndoList(list);
    },
    [flushPending, commit]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoList(null);
    LayoutAnimation.configureNext(REFLOW);
    myListsCache.restore(pending.list);
  }, []);

  // ---- Focus --------------------------------------------------------------

  const editingRef = useRef(editing);
  editingRef.current = editing;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      if (!myListsCache.getCached(userId)) {
        setStatus("loading");
        load();
      } else if (!myListsCache.isFresh()) {
        load();
      }

      // The root of a hidden tab, reached from the Profile drawer: back
      // returns there (after leaving edit mode first), not to Home.
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (editingRef.current) {
          setEditing(false);
          return true;
        }
        router.navigate("/profile");
        return true;
      });

      return () => {
        subscription.remove();
        // Leaving with a delete in its undo window commits it now.
        flushPending();
      };
    }, [userId, load, router, flushPending])
  );

  useEffect(() => () => flushPending(), [flushPending]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  // ---- Search -------------------------------------------------------------

  const owner = useMemo<Owner | null>(
    () => (user ? { _id: user._id, username: user.username, profile_pic_url: user.profile_pic_url } : null),
    [user?._id, user?.username, user?.profile_pic_url]
  );
  const allCards = useMemo(() => (owner ? lists.map((list) => cardFor(list, owner)) : []), [lists, owner]);
  const index = useMemo(() => buildNamedIndex(allCards, nameOf), [allCards]);
  // The count is exact on the frame of a keystroke; the list follows at low
  // priority and is abandoned if another keystroke lands first.
  const visible = useMemo(() => searchNamed(index, query), [index, query]);
  const shownCards = useDeferredValue(visible);
  const narrowed = query.trim().length > 0;

  // ---- Edit mode ----------------------------------------------------------

  const editProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(editProgress, { toValue: editing ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [editing, editProgress]);

  // Nothing left to edit: leave edit mode rather than showing a lone "Done".
  useEffect(() => {
    if (editing && lists.length === 0) setEditing(false);
  }, [editing, lists.length]);

  const toggleEdit = useCallback(() => setEditing((current) => !current), []);

  const openList = useCallback((card: DiscoverListItem) => router.push(`/lists/${card._id}` as never), [router]);

  // ---- New list -------------------------------------------------------------

  // The list editor adds the new list to myListsCache itself, so it's here
  // when the user comes back.
  const openComposer = useCallback(() => router.push("/list-editor"), [router]);

  // ---- Layout -------------------------------------------------------------

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        top: { paddingHorizontal: PADDING_X, paddingTop: 12, paddingBottom: 10, gap: 10 },
        loadingIndicator: { alignSelf: "flex-start", height: 36 },
        list: { paddingHorizontal: PADDING_X, paddingTop: 4, paddingBottom: LIST_PADDING_BOTTOM },
        skeleton: { paddingHorizontal: PADDING_X, paddingTop: 4 },
        newList: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          height: 34,
          borderRadius: 17,
          paddingLeft: 10,
          paddingRight: 14,
          backgroundColor: colors.primary,
        },
        newListText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryContent },
        pressed: { transform: [{ scale: 0.96 }] },
      }),
    [colors]
  );

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />,
    [refreshing, onRefresh, colors.primary]
  );

  // Hidden while editing, so edit mode only ever deletes.
  const newListButton = useMemo(
    () =>
      editing ? null : (
        <Pressable
          onPress={openComposer}
          hitSlop={6}
          accessibilityRole="button"
          style={({ pressed }) => [styles.newList, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={colors.primaryContent} />
          <Text style={styles.newListText}>{t("New List")}</Text>
        </Pressable>
      ),
    [editing, openComposer, styles, colors.primaryContent, t]
  );

  const deleteLabel = t("Delete");
  const renderItem: ListRenderItem<DiscoverListItem> = useCallback(
    ({ item }) => (
      <MyListRow
        card={item}
        editing={editing}
        editProgress={editProgress}
        onOpen={openList}
        onRemove={handleRemove}
        deleteLabel={deleteLabel}
      />
    ),
    [editing, editProgress, openList, handleRemove, deleteLabel]
  );

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <View style={styles.skeleton}>
        {SKELETON_CARDS.map((index) => (
          <ListCardSkeleton key={index} />
        ))}
      </View>
    );
  } else if (status === "error") {
    body = (
      <CollectionStateView
        icon="cloud-offline-outline"
        title={t("Failed to load lists.")}
        text={t("Check your connection and try again.")}
        action={{ label: t("Retry"), onPress: retry }}
      />
    );
  } else if (lists.length === 0) {
    body = (
      <CollectionStateView
        icon="albums-outline"
        title={t("You haven't created any lists yet.")}
        text={t("Add movies and shows to custom lists, then share them with friends.")}
        action={{ label: t("New List"), onPress: openComposer }}
      />
    );
  } else if (visible.length === 0) {
    body = <CollectionStateView icon="search-outline" title={t("No lists match your search.")} text={t("Try a different list name.")} />;
  } else {
    body = (
      <FlatList
        data={shownCards}
        keyExtractor={keyOf}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <CollectionSearchBar placeholder={t("Search your lists")} onChangeQuery={setQuery} />
        {status === "ready" && lists.length > 0 ? (
          <CollectionToolbar
            shown={visible.length}
            total={lists.length}
            narrowed={narrowed}
            countLabel={
              narrowed
                ? t("{{shown}} of {{total}} lists", { shown: visible.length, total: lists.length })
                : t("{{count}} lists", { count: lists.length })
            }
            accessory={newListButton}
            editing={editing}
            canEdit={visible.length > 0}
            onToggleEdit={toggleEdit}
          />
        ) : status === "loading" ? (
          <ActivityIndicator size="small" color={colors.placeholder} style={styles.loadingIndicator} />
        ) : null}
      </View>

      {body}

      <CollectionUndoBar entry={undoList} message={t("List deleted")} durationMs={UNDO_MS} onUndo={handleUndo} />
    </View>
  );
}

export default memo(MyListsScreen);
