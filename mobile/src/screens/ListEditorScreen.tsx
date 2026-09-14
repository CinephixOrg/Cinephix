import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useBadgeEarned } from "../context/BadgeEarnedContext";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { createList, getListById, updateList } from "../api/listService";
import { ensureContent, entryFor } from "../api/collectionCache";
import { myListsCache } from "../api/myListsCache";
import { getCachedSearch, getCachedSuggestions, loadSuggestions, searchTitles } from "../api/listEditorData";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import { CollectionStateView } from "../components/collection/CollectionStates";
import ConfirmDialog from "../components/settings/ConfirmDialog";
import {
  ADDED_COLUMNS,
  ADDED_GAP,
  AddedGrid,
  SearchResults,
  SuggestionsHint,
  SuggestionsRail,
  VisibilityToggle,
} from "../components/lists/ListEditorParts";
import {
  MIN_ITEMS_FOR_SUGGESTIONS,
  addToDraft,
  draftKey,
  isDraftChanged,
  removeFromDraft,
  seedsKey,
  suggestionSeeds,
  titleIdentity,
  yearOf,
  type DraftFields,
  type DraftItem,
} from "../utils/listDraft";
import { fonts } from "../theme/typography";

const PADDING_X = 16;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;
// Network search: long enough to skip a fast typist's intermediate queries.
const SEARCH_DEBOUNCE_MS = 300;
// Adding three titles in a row should cost one suggestions request, not three.
const SUGGESTIONS_DEBOUNCE_MS = 500;

// A title moving into the grid (from search or the suggestions rail) and out
// of it: the posters around it slide to make room or close the gap, as one
// native layout animation.
const MOVE = LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

const EMPTY_DRAFT: DraftFields = { name: "", description: "", isPublic: false, items: [] };

type Status = "loading" | "ready" | "error";

// Creating and editing a list, on one distraction-free page:
//
//   * the name, description and visibility, as borderless text on the canvas;
//   * a search that adds titles in place, with no trip to another page;
//   * once the list has three titles, a rail of suggestions drawn from the
//     last ones added (POST /api/lists/suggestions), one tap to add;
//   * the added titles as a poster grid, one tap to remove.
//
// Nothing is saved until the button at the bottom: the whole list, titles
// included, goes in one request. Leaving with unsaved changes asks first.
export default function ListEditorScreen() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const isEditing = Boolean(listId);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refresh: refreshProfile } = useProfile();
  const { reportEarnedBadges } = useBadgeEarned();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const userId = user?._id ?? "";

  const [status, setStatus] = useState<Status>(isEditing ? "loading" : "ready");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const baseline = useRef<DraftFields>(EMPTY_DRAFT);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(isEditing ? "Edit List" : "New List") });
  }, [navigation, isEditing, t]);

  // ---- Loading an existing list ------------------------------------------------

  const load = useCallback(async () => {
    if (!listId) return;
    setStatus("loading");
    try {
      const { list } = await getListById(listId);
      // Titles and posters from the shared content cache: two bulk requests
      // at most, none for titles already seen anywhere in the app.
      await ensureContent(list.items);
      const loaded: DraftItem[] = [];
      list.items.forEach((item, index) => {
        const entry = entryFor(String(item.itemId), item.itemType, index, null);
        if (entry) {
          loaded.push({ id: entry.id, type: entry.type, title: entry.title, posterPath: entry.posterPath, year: yearOf(entry.releaseDate) });
        }
      });
      baseline.current = { name: list.name, description: list.description ?? "", isPublic: list.isPublic, items: loaded };
      setName(list.name);
      setDescription(list.description ?? "");
      setIsPublic(list.isPublic);
      setItems(loaded);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [listId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- The draft ------------------------------------------------------------------

  const addedKeys = useMemo(() => new Set(items.map(draftKey)), [items]);

  const addItem = useCallback((item: DraftItem) => {
    LayoutAnimation.configureNext(MOVE);
    setItems((current) => addToDraft(current, item));
  }, []);

  const removeItem = useCallback((key: string) => {
    LayoutAnimation.configureNext(MOVE);
    setItems((current) => removeFromDraft(current, key));
  }, []);

  // A search result is a toggle: tapping an added title takes it back off.
  const toggleItem = useCallback(
    (item: DraftItem) => {
      if (addedKeys.has(draftKey(item))) removeItem(draftKey(item));
      else addItem(item);
    },
    [addedKeys, addItem, removeItem]
  );

  // ---- Search ---------------------------------------------------------------------

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DraftItem[]>([]);
  const [searching, setSearching] = useState(false);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    const cached = getCachedSearch(trimmed);
    if (cached) {
      setResults(cached);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchTitles(trimmed)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    // A newer query supersedes this one's response.
    return () => {
      cancelled = true;
    };
  }, [query]);

  // ---- Suggestions ------------------------------------------------------------------

  const seeds = useMemo(() => suggestionSeeds(items), [items]);
  const currentSeedsKey = seedsKey(seeds);
  const [suggestionPool, setSuggestionPool] = useState<DraftItem[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  // Read when the debounce fires, so the effect only re-runs when the seeds change.
  const latest = useRef({ seeds, items });
  latest.current = { seeds, items };

  useEffect(() => {
    if (!currentSeedsKey) {
      setSuggestionPool([]);
      setSuggesting(false);
      return;
    }
    const cached = getCachedSuggestions(currentSeedsKey);
    if (cached) {
      setSuggestionPool(cached);
      setSuggesting(false);
      return;
    }
    let cancelled = false;
    setSuggesting(true);
    const timer = setTimeout(() => {
      loadSuggestions(currentSeedsKey, latest.current.seeds, latest.current.items)
        .then((pool) => {
          if (!cancelled) setSuggestionPool(pool);
        })
        .catch(() => {
          // Suggestions are a bonus: without them the editor works the same.
        })
        .finally(() => {
          if (!cancelled) setSuggesting(false);
        });
    }, SUGGESTIONS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSeedsKey]);

  // The previous pool stays up while a new one loads, minus anything added
  // since, so a tapped suggestion leaves the rail as it lands in the grid.
  // Matched by title as well as record: a suggestion can be a duplicate
  // catalogue record of a title that's already on the list.
  const addedTitles = useMemo(() => new Set(items.map(titleIdentity)), [items]);
  const suggestions = useMemo(
    () => suggestionPool.filter((item) => !addedKeys.has(draftKey(item)) && !addedTitles.has(titleIdentity(item))),
    [suggestionPool, addedKeys, addedTitles]
  );

  // ---- Leaving and saving -------------------------------------------------------------

  const draft: DraftFields = { name, description, isPublic, items };
  const changed = status === "ready" && isDraftChanged(baseline.current, draft);
  const changedRef = useRef(changed);
  changedRef.current = changed;
  const allowLeave = useRef(false);
  const [pendingLeave, setPendingLeave] = useState<unknown>(null);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event: any) => {
        if (allowLeave.current || !changedRef.current) return;
        event.preventDefault();
        setPendingLeave(event.data.action);
      }),
    [navigation]
  );

  const discard = useCallback(() => {
    const action = pendingLeave;
    setPendingLeave(null);
    allowLeave.current = true;
    if (action) navigation.dispatch(action as never);
  }, [navigation, pendingLeave]);
  const keepEditing = useCallback(() => setPendingLeave(null), []);

  const trimmedName = name.trim();
  const canSave = status === "ready" && trimmedName.length > 0 && !saving && (!isEditing || changed);

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    const fields = {
      name: trimmedName,
      description: description.trim(),
      isPublic,
      items: items.map((item) => ({ itemId: item.id, itemType: item.type })),
    };
    try {
      if (listId) {
        const updated = await updateList(listId, fields);
        myListsCache.upsert(userId, updated);
        allowLeave.current = true;
        router.back();
      } else {
        const { list, newlyEarnedBadges } = await createList(fields);
        reportEarnedBadges(newlyEarnedBadges);
        myListsCache.upsert(userId, list);
        refreshProfile({ force: true });
        allowLeave.current = true;
        // Close the editor (a root-level screen) first, then open the new list
        // in the Lists tab. withAnchor puts that stack's first screen, My
        // Lists, beneath it, so the list always has a Back button — a plain
        // replace across navigators opened the list alone in its stack, with
        // no way back.
        if (router.canGoBack()) router.back();
        router.push(`/lists/${list._id}` as never, { withAnchor: true });
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || t(listId ? "Failed to update list." : "Failed to create list."));
      setSaving(false);
    }
  }, [canSave, trimmedName, description, isPublic, items, listId, userId, router, reportEarnedBadges, refreshProfile, showToast, t]);

  // ---- Layout ---------------------------------------------------------------------------

  const tileWidth = Math.floor((screenWidth - PADDING_X * 2 - ADDED_GAP * (ADDED_COLUMNS - 1)) / ADDED_COLUMNS);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { paddingBottom: 140 },
        canvas: { paddingHorizontal: PADDING_X, paddingTop: 18, gap: 6 },
        nameInput: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.baseContent, paddingVertical: 4 },
        descriptionInput: {
          fontFamily: fonts.regular,
          fontSize: 15,
          lineHeight: 21,
          color: colors.baseContent,
          paddingVertical: 4,
          minHeight: 30,
          textAlignVertical: "top",
        },
        visibility: { marginTop: 10 },
        search: { paddingHorizontal: PADDING_X, paddingTop: 22 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PADDING_X,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.base100,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        saveButton: {
          height: 52,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        },
        saveDisabled: { opacity: 0.45 },
        savePressed: { transform: [{ scale: 0.98 }] },
        saveText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryContent },
        saveCount: { fontFamily: fonts.medium, fontSize: 14, color: colors.primaryContent, opacity: 0.8 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
      }),
    [colors, insets.bottom]
  );

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.screen}>
        <CollectionStateView
          icon="cloud-offline-outline"
          title={t("Failed to load list.")}
          text={t("Check your connection and try again.")}
          action={{ label: t("Retry"), onPress: load }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.canvas}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={t("List name")}
            placeholderTextColor={colors.placeholder}
            maxLength={NAME_MAX}
            autoFocus={!isEditing}
            returnKeyType="next"
          />
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder={t("Add a description")}
            placeholderTextColor={colors.placeholder}
            maxLength={DESCRIPTION_MAX}
            multiline
          />
          <View style={styles.visibility}>
            <VisibilityToggle isPublic={isPublic} onChange={setIsPublic} />
          </View>
        </View>

        <View style={styles.search}>
          <CollectionSearchBar
            placeholder={t("Search movies and series")}
            onChangeQuery={setQuery}
            debounceMs={SEARCH_DEBOUNCE_MS}
          />
        </View>

        {hasQuery ? (
          <SearchResults results={results} searching={searching} addedKeys={addedKeys} onToggle={toggleItem} />
        ) : items.length < MIN_ITEMS_FOR_SUGGESTIONS ? (
          <SuggestionsHint added={items.length} needed={MIN_ITEMS_FOR_SUGGESTIONS} />
        ) : (
          <SuggestionsRail suggestions={suggestions} loading={suggesting} onAdd={addItem} />
        )}

        <AddedGrid items={items} tileWidth={tileWidth} onRemove={removeItem} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          style={({ pressed }) => [styles.saveButton, !canSave && styles.saveDisabled, pressed && styles.savePressed]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryContent} />
          ) : (
            <>
              <Text style={styles.saveText}>{t(isEditing ? "Save changes" : "Create List")}</Text>
              {items.length > 0 ? <Text style={styles.saveCount}>· {items.length}</Text> : null}
            </>
          )}
        </Pressable>
      </View>

      <ConfirmDialog
        visible={pendingLeave !== null}
        icon="alert-circle-outline"
        title={t("Discard changes?")}
        message={t("Your changes to this list won't be saved.")}
        confirmLabel={t("Discard")}
        cancelLabel={t("Keep editing")}
        danger
        emphasis="solid"
        onConfirm={discard}
        onCancel={keepEditing}
      />
    </KeyboardAvoidingView>
  );
}
