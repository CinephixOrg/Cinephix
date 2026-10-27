import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Animated,
  ActivityIndicator,
  BackHandler,
  Image,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Pressable from "../components/common/TapSafePressable";
import Modal from "../components/common/GestureModal";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { addItem, getListById, removeItem, toggleListLike, updateList } from "../api/listService";
import { getCachedSearch, searchTitles } from "../api/listEditorData";
import { createShare } from "../api/shareService";
import { getOrCreateConversation, sendRichMessage } from "../api/conversationService";
import { sendGroupRichMessage } from "../api/groupService";
import UserAvatar from "../components/UserAvatar";
import ShareOptionsMenu from "../components/ShareOptionsMenu";
import UserSharePickerModal from "../components/UserSharePickerModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRecentShares } from "../context/RecentSharesContext";
import { useComposeTutorial } from "../context/ComposeTutorialContext";
import TutorialSpotlight from "../components/tutorial/TutorialSpotlight";
import TutorialInfoBox from "../components/tutorial/TutorialInfoBox";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import CollectionToolbar from "../components/collection/CollectionToolbar";
import CollectionFilterSheet from "../components/collection/CollectionFilterSheet";
import CollectionGrid from "../components/collection/CollectionGrid";
import CollectionUndoBar from "../components/collection/CollectionUndoBar";
import { CollectionSkeleton, CollectionStateView } from "../components/collection/CollectionStates";
import { useGridMetrics, useCollectionQuery } from "../components/collection/useCollectionQuery";
import { WATCHLIST_SORT_GROUPS } from "../components/collection/filterLabels";
import type { CollectionEntry } from "../utils/collectionQuery";
import type { CustomListDetail, ListPreviewItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { snippet } from "../utils/shareCards";
import { MemberAddToggle, SearchResults, VisibilityToggle } from "../components/lists/ListEditorParts";
import MoreButton from "../components/safety/MoreButton";
import { draftKey, type DraftItem } from "../utils/listDraft";
import { useKeyboardSafeExit } from "../hooks/useKeyboardSafeExit";

const GRID_PADDING_BOTTOM = 110;
const UNDO_MS = 4000;

type Status = "loading" | "ready" | "error";

const sameEntry = (a: CollectionEntry, b: CollectionEntry) => a.id === b.id && a.type === b.type;

// Maps the server's bulk-hydrated previewItems (see hydratePreviewItems,
// backend/utils/listPreview.js) into the same CollectionEntry shape the
// Watched List / Watchlist query engine (useCollectionQuery) already runs
// on — reused verbatim rather than a scoped-down copy, since a list's
// items are the exact same "id/type/title/poster/release date" shape,
// just with no personal rating (a curated list isn't a watch record).
// `order` is assigned so the DEFAULT (unsorted) view reproduces the
// owner's own item order first-to-last: queryCollection's own tie-break
// is `b.order - a.order` (descending), so the first item needs the
// highest value, not index itself.
function toEntries(items: ListPreviewItem[]): CollectionEntry[] {
  const total = items.length;
  return items.map((item, index) => ({
    id: item.itemId,
    type: item.itemType,
    title: item.title,
    posterPath: item.poster_path ?? null,
    releaseDate: item.release_date ?? null,
    popularity: item.popularity ?? 0,
    rating: null,
    order: total - 1 - index,
  }));
}

interface Props {
  // Which tab's own nested Stack this screen is being rendered inside of —
  // forwarded to MiniContentCard's basePath equivalent (CollectionGrid's
  // own onOpen navigation) so content-detail navigation stays within that
  // same Stack. Defaults to "/lists" since that's this screen's original home.
  basePath?: "/lists" | "/home" | "/search" | "/profile" | "/socials" | `/user/${string}`;
}

export default function ListDetailScreen({ basePath = "/lists" }: Props) {
  const { colors } = useTheme();
  useKeyboardSafeExit();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
        header: { paddingHorizontal: 16, paddingTop: 16 },
        ownerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        communityTile: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.base300, alignItems: "center", justifyContent: "center", overflow: "hidden" },
        memberAddHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.primary, marginTop: 10 },
        ownerLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
        ownerName: { fontSize: 13, color: colors.placeholder, fontFamily: fonts.medium },
        ownerNameTag: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder, opacity: 0.75 },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 },
        title: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent },
        // Same font/size as the static title/description Text above it —
        // only the editing-mode wrapper (below) signals "editable now",
        // matching how a poster gets a remove overlay rather than changing
        // its own look.
        titleInput: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent, padding: 0 },
        descriptionInput: { color: colors.baseContent, fontSize: 14, lineHeight: 20, padding: 0 },
        editableField: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 8,
          backgroundColor: colors.base200,
          paddingHorizontal: 8,
          paddingVertical: 6,
        },
        badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
        badgePublic: { backgroundColor: colors.primary },
        badgePrivate: { backgroundColor: colors.border },
        badgeText: { fontSize: 11, fontFamily: fonts.medium, color: colors.baseContent },
        description: { color: colors.baseContent, fontSize: 14, marginTop: 8, lineHeight: 20 },
        shareAccessory: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          height: 34,
          borderRadius: 17,
          paddingLeft: 10,
          paddingRight: 13,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shareAccessoryText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.baseContent },
        toolbarAccessoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        addAccessory: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        addModalOverlay: { flex: 1, backgroundColor: colors.base100 },
        addModalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 10,
        },
        addModalTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        addModalSearch: { paddingHorizontal: 12, paddingTop: 4 },
        statsRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
        statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
        statText: { fontSize: 13, color: colors.placeholder },
        statTextActive: { color: colors.primary, fontFamily: fonts.medium },
        likeStatText: { fontSize: 14 },
        statsRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 14 },
        toolbarWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 },
        loadingIndicator: { alignSelf: "flex-start", height: 36 },
        errorText: { color: colors.error, marginTop: 8, marginHorizontal: 16 },
      }),
    [colors]
  );

  // `listId` on the copy nested under user/[id] — there the bare `id` is
  // already taken by the profile owner, so the list gets its own param name.
  const { id, listId } = useLocalSearchParams<{ id: string; listId?: string }>();
  const targetListId = listId || id;
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { showToast } = useToast();
  const { announce: announceNewShare } = useRecentShares();
  // Last step of the "List" compose-tutorial walkthrough (Shares' "+" menu
  // → Lists tab → here) — set unconditionally on mount, same pattern every
  // other tutorial's final screen uses; the actual highlight only ever
  // shows once `isOwner && list.isPublic` below is also true (the exact
  // same condition the real "Share your list" button needs to render at
  // all), so this is harmless on a list that doesn't qualify.
  const { tutorial: composeTutorial, setListStep, endTutorial: endComposeTutorial } = useComposeTutorial();
  useEffect(() => {
    if (composeTutorial?.id === "list") setListStep("tapShare");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showShareListTutorial = composeTutorial?.id === "list" && composeTutorial.step === "tapShare";

  const [list, setList] = useState<CustomListDetail | null>(null);

  // The native header never showed anything useful here before — this
  // screen manages its own in-body title row, but the Stack header itself
  // had no title set at all, which read as literal route/param garbage
  // once this screen started getting reached from more than one nested
  // stack (communities/[slug]/lists/[listId], not just the two it
  // already had). The real list name once it loads, a generic fallback
  // before that.
  useLayoutEffect(() => {
    navigation.setOptions({ title: list?.name || t("List") });
  }, [navigation, list?.name, t]);

  const [isOwner, setIsOwner] = useState(false);
  // Only meaningful alongside list.groupId — whether this viewer (a
  // member, not the admin) can add titles to this community list, see
  // CustomList.allowMemberAdd's own comment. Surfaced here as a hint only
  // (adding itself happens from a content detail page's own "Add to
  // List," same as it already does for any list).
  const [canAddItems, setCanAddItems] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [undoEntry, setUndoEntry] = useState<CollectionEntry | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Inline name/description editing — active only while `editing` (the same
  // toggle that puts the poster grid into remove mode) is on, direct ask:
  // "nasıl o posterler edit moduna geçiyorsa, descr ve başlık da o moda
  // geçsin", replacing the old separate "Edit List" button/screen entirely.
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  // Community list only — direct ask, after this was only ever settable
  // once, at creation (GroupListEditorScreen): the admin should be able
  // to change their mind later too, same Edit/Done cycle as name/
  // description/visibility.
  const [editAllowMemberAdd, setEditAllowMemberAdd] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [sharingToMedia, setSharingToMedia] = useState(false);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const [sharePickerVisible, setSharePickerVisible] = useState(false);
  const [sharingToOthers, setSharingToOthers] = useState(false);

  // Adding a title — direct ask, after this page had no way to add one at
  // all (only remove, via edit mode): any list's own owner, or a
  // community list's member once the admin opted them in (canAddItems),
  // can add from here. Search-only (no suggestions rail, unlike the
  // editor screens) — this is a quick top-up, not building a list from
  // scratch.
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<DraftItem[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const listRef = useRef<CustomListDetail | null>(null);
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;

  // A genuinely different list (not just a refocus of the same one) starts
  // over from the loading skeleton rather than quietly revalidating over
  // whatever the previous list left on screen.
  useEffect(() => {
    listRef.current = null;
    setStatus("loading");
  }, [targetListId]);

  const load = useCallback(async () => {
    try {
      const { list: fetchedList, isOwner: owner, hasLiked: liked, canAddItems: addable } = await getListById(targetListId);
      listRef.current = fetchedList;
      setList(fetchedList);
      setIsOwner(owner);
      setCanAddItems(addable);
      setLikeCount(fetchedList.likeCount);
      setHasLiked(liked);
      setEntries(toEntries(fetchedList.previewItems ?? []));
      setStatus("ready");
      setError(null);
    } catch (e: any) {
      const message = e?.response?.data?.message || tRef.current("Failed to load list.");
      // A failed refresh over a list that's already on screen isn't worth
      // replacing that list with an error; a failed first load is — same
      // stale-while-revalidate discipline CollectionScreen.tsx's own load()
      // uses for the Watched List / Watchlist.
      if (listRef.current) toastRef.current(message);
      else {
        setStatus("error");
        setError(message);
      }
    }
  }, [targetListId]);

  // ---- Removal with undo (same shape as CollectionScreen.tsx's own
  // hide/commit/undo state machine, backed by a direct API call instead of
  // a shared cross-visit cache — a single list detail page only ever
  // manages the one list it's showing, so a whole cache module for it
  // would be a bigger abstraction than this actually needs). ----

  const pendingRef = useRef<{ entry: CollectionEntry; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = useCallback(
    (entry: CollectionEntry) => {
      removeItem(targetListId, entry.id, entry.type).catch((e: any) => {
        toastRef.current(e?.response?.data?.message || tRef.current("Failed to remove item."));
      });
    },
    [targetListId]
  );

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoEntry(null);
    commit(pending.entry);
  }, [commit]);

  const handleRemove = useCallback(
    (entry: CollectionEntry) => {
      if (pendingRef.current && sameEntry(pendingRef.current.entry, entry)) return;
      flushPending();
      setEntries((prev) => prev.filter((e) => !sameEntry(e, entry)));
      const timer = setTimeout(() => {
        if (pendingRef.current?.entry !== entry) return;
        pendingRef.current = null;
        setUndoEntry(null);
        commit(entry);
      }, UNDO_MS);
      pendingRef.current = { entry, timer };
      setUndoEntry(entry);
    },
    [flushPending, commit]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setUndoEntry(null);
    setEntries((prev) => {
      if (prev.some((e) => sameEntry(e, pending.entry))) return prev;
      return [...prev, pending.entry].sort((a, b) => b.order - a.order);
    });
  }, []);

  // ---- Focus ----------------------------------------------------------

  const editingRef = useRef(editing);
  editingRef.current = editing;

  useFocusEffect(
    useCallback(() => {
      if (!listRef.current) setStatus("loading");
      load();

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (editingRef.current) {
          setEditing(false);
          return true;
        }
        return false; // default: pop this screen
      });

      return () => {
        subscription.remove();
        // Leaving with a removal still in its undo window commits it now,
        // rather than letting a timer fire against an unmounted screen.
        flushPending();
      };
    }, [load, flushPending])
  );

  useEffect(() => () => flushPending(), [flushPending]);

  // ---- Query ------------------------------------------------------------

  const query = useCollectionQuery(entries);

  // ---- Edit mode ----------------------------------------------------------

  const editProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(editProgress, { toValue: editing ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [editing, editProgress]);

  // Saves name/description/visibility if any changed, called whenever edit
  // mode turns off (the toolbar's own "Done" tap, or the auto-exit below).
  // Silent no-op if nothing changed — most Edit/Done cycles are just item removal.
  const commitMetaEdits = useCallback(async () => {
    if (!list) return;
    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();
    const allowMemberAddChanged = !!list.groupId && editAllowMemberAdd !== !!list.allowMemberAdd;
    if (trimmedName === list.name && trimmedDescription === (list.description || "") && editPublic === list.isPublic && !allowMemberAddChanged) return;
    // An emptied-out name is dropped silently rather than saved — same
    // "Name is required" rule the backend already enforces (customListRoute.js).
    if (!trimmedName) return;
    setSavingMeta(true);
    try {
      await updateList(targetListId, {
        name: trimmedName,
        description: trimmedDescription,
        isPublic: editPublic,
        ...(list.groupId ? { allowMemberAdd: editAllowMemberAdd } : {}),
      });
      setList((prev) => (prev ? { ...prev, name: trimmedName, description: trimmedDescription, isPublic: editPublic, allowMemberAdd: editAllowMemberAdd } : prev));
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSavingMeta(false);
    }
  }, [list, editName, editDescription, editPublic, editAllowMemberAdd, targetListId, showToast, t]);

  // Nothing left to edit — leave edit mode rather than showing a lone "Done".
  useEffect(() => {
    if (editing && entries.length === 0) {
      setEditing(false);
      commitMetaEdits();
    }
  }, [editing, entries.length, commitMetaEdits]);

  const toggleEdit = useCallback(() => {
    if (editing) {
      setEditing(false);
      commitMetaEdits();
    } else {
      if (list) {
        setEditName(list.name);
        setEditDescription(list.description || "");
        setEditPublic(list.isPublic);
        setEditAllowMemberAdd(!!list.allowMemberAdd);
      }
      setEditing(true);
    }
  }, [editing, list, commitMetaEdits]);

  const openEntry = useCallback(
    (entry: CollectionEntry) => router.push(`${basePath}/content/${entry.type}/${entry.id}` as any),
    [router, basePath]
  );

  const handleLike = async () => {
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likeCount;
    setHasLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLiking(true);
    try {
      const result = await toggleListLike(targetListId);
      setHasLiked(result.hasLiked);
      setLikeCount(result.likeCount);
    } catch {
      setHasLiked(prevLiked);
      setLikeCount(prevCount);
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setLiking(false);
    }
  };

  const addedKeys = useMemo(() => new Set(entries.map(draftKey)), [entries]);

  useEffect(() => {
    if (!addModalVisible) return;
    const trimmed = addQuery.trim();
    if (!trimmed) {
      setAddResults([]);
      setAddSearching(false);
      return;
    }
    const cached = getCachedSearch(trimmed);
    if (cached) {
      setAddResults(cached);
      setAddSearching(false);
      return;
    }
    let cancelled = false;
    setAddSearching(true);
    searchTitles(trimmed)
      .then((found) => {
        if (!cancelled) setAddResults(found);
      })
      .catch(() => {
        if (!cancelled) setAddResults([]);
      })
      .finally(() => {
        if (!cancelled) setAddSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addModalVisible, addQuery]);

  // Add-only — tapping an already-added result here is a no-op (SearchResults
  // itself doesn't distinguish), removing one stays exclusively edit mode's
  // own job (owner-only, see onRemove below).
  const addSearchResult = useCallback(
    async (item: DraftItem) => {
      const key = draftKey(item);
      if (addedKeys.has(key) || addingKey) return;
      setAddingKey(key);
      try {
        await addItem(targetListId, item.id, item.type);
        setEntries((prev) => [
          {
            id: item.id,
            type: item.type,
            title: item.title,
            posterPath: item.posterPath,
            // DraftItem only carries a bare year (listEditorData's own
            // search shape) — approximate, corrected on the next real
            // fetch; good enough for display/sort until then.
            releaseDate: item.year ? `${item.year}-01-01` : null,
            popularity: 0,
            rating: null,
            order: prev.length ? Math.max(...prev.map((e) => e.order)) + 1 : 0,
          },
          ...prev,
        ]);
      } catch (e: any) {
        showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      } finally {
        setAddingKey(null);
      }
    },
    [targetListId, addedKeys, addingKey, showToast, t]
  );

  // "Share your list" (CollectionToolbar's accessory) opens ShareOptionsMenu
  // instead of posting to Media directly — direct ask: give a Send-to-a-
  // Person-or-Community option too, same 2-option popover every other
  // share entry point with a real DM/community picker already uses
  // (ContentDetailScreen's recommend flow, ProfileAnalysisModal).
  const handleShareToMedia = async () => {
    if (!list) return;
    setSharingToMedia(true);
    try {
      const share = await createShare({ type: "list", listId: list._id });
      announceNewShare(share);
      setShareMenuVisible(false);
      showToast(t("Shared to Media"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingToMedia(false);
    }
  };

  const handleConfirmShareToOthers = async (userIds: string[], groupIds: string[]) => {
    if (!list || !user) return;
    setSharingToOthers(true);
    try {
      const text = t("Check out {{username}}'s list on Cinephix!", { username: user.username });
      const listData = {
        listId: list._id,
        name: list.name,
        itemCount: entries.length,
        // The first three titles that have a poster, for the card's collage.
        previewPosters: entries
          .map((e) => e.posterPath)
          .filter((p): p is string => !!p)
          .slice(0, 3),
        description: snippet(list.description),
        ownerUsername: list.owner.username,
      };
      // allSettled, not all — same reasoning as ContentDetailScreen's own
      // handleSendRecommendation: one recipient shouldn't sink the send to
      // everyone else picked in the same batch.
      const results = await Promise.allSettled([
        ...userIds.map(async (uid) => {
          const conv = await getOrCreateConversation(uid);
          await sendRichMessage(conv._id, { text, type: "list_share", listData });
        }),
        ...groupIds.map((groupId) => sendGroupRichMessage(groupId, { text, type: "list_share", listData })),
      ]);
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failures.length > 0 && failures.length === results.length) {
        showToast(failures[0].reason?.response?.data?.message || t("Something went wrong. Please try again."));
        return;
      }
      setSharePickerVisible(false);
      showToast(t("Shared"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingToOthers(false);
    }
  };

  // ---- Layout -------------------------------------------------------------

  const metrics = useGridMetrics(screenWidth);

  if (status === "error" && !list) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!list && status === "loading") {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.ownerRow}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.base200 }} />
          </View>
        </View>
        <CollectionSkeleton metrics={metrics} />
      </View>
    );
  }

  if (!list) return null;

  // Add-only right here is intentionally the only "add" surface (list
  // creation screens are for a fresh list, not topping off an existing
  // one) — owner always, or a community list's member once allowMemberAdd
  // is on (canAddItems, computed server-side).
  const canAdd = isOwner || canAddItems;

  let body: React.ReactNode;
  if (status === "loading") {
    body = <CollectionSkeleton metrics={metrics} />;
  } else if (entries.length === 0) {
    body = (
      <CollectionStateView
        icon="film-outline"
        title={t("No items in this list yet.")}
        action={canAdd ? { label: t("Add a title"), onPress: () => setAddModalVisible(true) } : undefined}
      />
    );
  } else if (query.visible.length === 0) {
    body = (
      <CollectionStateView
        icon="search-outline"
        title={t("No titles match your search.")}
        text={t("Try a different title or clear your filters.")}
        action={query.filterCount > 0 ? { label: t("Clear all"), onPress: query.clearFilters } : undefined}
      />
    );
  } else {
    body = (
      <CollectionGrid
        entries={query.gridEntries}
        metrics={metrics}
        paddingBottom={GRID_PADDING_BOTTOM}
        editing={editing}
        editProgress={editProgress}
        onOpen={openEntry}
        onRemove={isOwner ? handleRemove : undefined}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.ownerLine}>
          {/* A community list leads with the COMMUNITY, full stop — not
              the admin who happened to create it, see CustomList.groupId's
              own comment ("listlerin communitye ait olduğunu anlaman
              lazım"). */}
          {list.groupId ? (
            <Pressable style={styles.ownerRow} onPress={() => router.push(`/socials/communities/${list.groupId!.slug}` as never)}>
              <View style={styles.communityTile}>
                {list.groupId.coverImage ? (
                  <Image source={{ uri: list.groupId.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Ionicons name="people" size={15} color={list.groupId.accentColor || colors.primary} />
                )}
              </View>
              <Text style={styles.ownerName}>
                {list.groupId.name} <Text style={styles.ownerNameTag}>({t("Community")})</Text>
              </Text>
            </Pressable>
          ) : (
            <Pressable style={styles.ownerRow} onPress={() => router.push(`/user/${list.owner._id}`)}>
              <UserAvatar
                userId={list.owner._id}
                username={list.owner.username}
                profilePicUrl={list.owner.profile_pic_url}
                size={28}
                disabled
              />
              <Text style={styles.ownerName}>{list.owner.username}</Text>
            </Pressable>
          )}
          {/* Report the list, or block its owner — which also leaves it. */}
          <MoreButton
            entityType="List"
            entityId={list._id}
            author={list.owner}
            onBlocked={() => (router.canGoBack() ? router.back() : router.replace("/profile/lists" as never))}
          />
        </View>

        <View style={styles.titleRow}>
          {editing && isOwner ? (
            <TextInput
              style={[styles.titleInput, styles.editableField, { flex: 1 }]}
              value={editName}
              onChangeText={setEditName}
              maxLength={80}
              placeholder={t("List name")}
              placeholderTextColor={colors.placeholder}
            />
          ) : (
            <Text style={styles.title}>{list.name}</Text>
          )}
          {/* While editing, the Public/Private toggle below replaces this badge. */}
          {editing && isOwner ? null : (
            <View style={[styles.badge, list.isPublic ? styles.badgePublic : styles.badgePrivate]}>
              <Text style={styles.badgeText}>{list.isPublic ? t("Public") : t("Private")}</Text>
            </View>
          )}
        </View>

        {editing && isOwner ? (
          <TextInput
            style={[styles.descriptionInput, styles.editableField, { marginTop: 8 }]}
            value={editDescription}
            onChangeText={setEditDescription}
            maxLength={300}
            multiline
            placeholder={t("Add a description...")}
            placeholderTextColor={colors.placeholder}
          />
        ) : list.description ? (
          <Pressable onPress={() => setDescriptionExpanded((e) => !e)}>
            <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 2} ellipsizeMode="tail">
              {list.description}
            </Text>
          </Pressable>
        ) : null}

        {editing && isOwner ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <VisibilityToggle isPublic={editPublic} onChange={setEditPublic} />
            {list.groupId ? <MemberAddToggle allowMemberAdd={editAllowMemberAdd} onChange={setEditAllowMemberAdd} /> : null}
          </View>
        ) : null}

        {!editing && list.groupId && canAddItems && !isOwner ? (
          <Text style={styles.memberAddHint}>{t("You can add titles here — open any title and tap Add to List.")}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <Pressable style={styles.statItem} onPress={handleLike} disabled={liking} hitSlop={8}>
            <Ionicons
              name={hasLiked ? "heart" : "heart-outline"}
              size={18}
              color={hasLiked ? colors.primary : colors.placeholder}
            />
            <Text style={[styles.statText, styles.likeStatText, hasLiked && styles.statTextActive]}>
              {hasLiked ? t("Liked") : t("Like?")} {likeCount}
            </Text>
          </Pressable>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={15} color={colors.placeholder} />
            <Text style={styles.statText}>{t("view_count", { count: list.views ?? 0 })}</Text>
          </View>
        </View>
        <View style={styles.statsRowDivider} />

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.toolbarWrap}>
        <CollectionSearchBar
          placeholder={t("Search this list")}
          onChangeQuery={query.setQuery}
          onOpenFilters={query.openSheet}
          activeFilterCount={query.filterCount}
        />
        {status === "ready" && entries.length > 0 ? (
          <CollectionToolbar
            shown={query.visible.length}
            total={entries.length}
            narrowed={query.narrowed}
            filters={query.filters}
            onFilterAction={query.onFilterAction}
            accessory={
              editing ? undefined : (
                <View style={styles.toolbarAccessoryRow}>
                  {canAdd ? (
                    <Pressable style={styles.addAccessory} onPress={() => setAddModalVisible(true)} hitSlop={4} accessibilityLabel={t("Add a title")}>
                      <Ionicons name="add" size={16} color={colors.baseContent} />
                    </Pressable>
                  ) : null}
                  {/* Not offered at all for a community list — direct
                      ask: how a community's own content should surface
                      in the main Shares feed hasn't been decided yet. */}
                  {isOwner && list.isPublic && !list.groupId ? (
                    <TutorialSpotlight active={showShareListTutorial}>
                      <Pressable
                        style={styles.shareAccessory}
                        onPress={() => {
                          // Arrived via the "List" compose-tutorial — using +
                          // already answered "share to Media," same reasoning
                          // as every other tutorial's final step, so skip
                          // ShareOptionsMenu and do it directly.
                          if (showShareListTutorial) {
                            handleShareToMedia();
                            endComposeTutorial();
                            return;
                          }
                          setShareMenuVisible(true);
                        }}
                        hitSlop={4}
                        accessibilityLabel={t("Share your list")}
                      >
                        <Ionicons name="share-social-outline" size={15} color={colors.baseContent} />
                        <Text style={styles.shareAccessoryText}>{t("Share your list")}</Text>
                      </Pressable>
                    </TutorialSpotlight>
                  ) : null}
                </View>
              )
            }
            editing={editing}
            canEdit={isOwner && query.visible.length > 0 && !savingMeta}
            onToggleEdit={isOwner ? toggleEdit : undefined}
          />
        ) : status === "loading" ? (
          <ActivityIndicator size="small" color={colors.placeholder} style={styles.loadingIndicator} />
        ) : null}
      </View>
      {showShareListTutorial && (
        <TutorialInfoBox text={t("Tap here to share your list to Media.")} onDismiss={endComposeTutorial} />
      )}

      {body}

      <CollectionUndoBar entry={undoEntry} message={t("Removed from list")} durationMs={UNDO_MS} onUndo={handleUndo} />

      <CollectionFilterSheet
        visible={query.sheetOpen}
        onClose={query.closeSheet}
        filters={query.filters}
        onAction={query.onFilterAction}
        resultCount={query.visible.length}
        sortGroups={WATCHLIST_SORT_GROUPS}
        showRatedFilter={false}
      />

      <ShareOptionsMenu
        visible={shareMenuVisible}
        onClose={() => setShareMenuVisible(false)}
        onSendToPeople={() => {
          setShareMenuVisible(false);
          setSharePickerVisible(true);
        }}
        onShareToMedia={handleShareToMedia}
        sharing={sharingToMedia}
      />

      <UserSharePickerModal
        visible={sharePickerVisible}
        title={t("Share List")}
        onClose={() => setSharePickerVisible(false)}
        sending={sharingToOthers}
        onConfirm={handleConfirmShareToOthers}
        allowGroups
      />

      <Modal visible={addModalVisible} animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalHeader}>
            <Text style={styles.addModalTitle}>{t("Add a title")}</Text>
            <Pressable onPress={() => setAddModalVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>
          <View style={styles.addModalSearch}>
            <CollectionSearchBar placeholder={t("Search movies and series")} onChangeQuery={setAddQuery} debounceMs={300} />
          </View>
          <SearchResults results={addResults} searching={addSearching} addedKeys={addedKeys} onToggle={addSearchResult} />
        </View>
      </Modal>
    </View>
  );
}
