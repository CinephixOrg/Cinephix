import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { createGroupList } from "../api/groupService";
import { getCachedSearch, getCachedSuggestions, loadSuggestions, searchTitles } from "../api/listEditorData";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import ConfirmDialog from "../components/settings/ConfirmDialog";
import {
  ADDED_COLUMNS,
  ADDED_GAP,
  AddedGrid,
  MemberAddToggle,
  SearchResults,
  SuggestionsHint,
  SuggestionsRail,
  VisibilityToggle,
} from "../components/lists/ListEditorParts";
import {
  MIN_ITEMS_FOR_SUGGESTIONS,
  addToDraft,
  draftKey,
  removeFromDraft,
  seedsKey,
  suggestionSeeds,
  titleIdentity,
  type DraftItem,
} from "../utils/listDraft";
import { fonts } from "../theme/typography";
import { useKeyboardSafeExit } from "../hooks/useKeyboardSafeExit";

const PADDING_X = 16;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;
const SEARCH_DEBOUNCE_MS = 300;
const SUGGESTIONS_DEBOUNCE_MS = 500;

const MOVE = LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

// A community admin creating a list FOR their community — ?slug=<group
// slug>. Mirrors ListEditorScreen.tsx's own canvas (name/description/
// visibility, search-and-add, suggestions rail, poster grid) almost
// exactly, with one addition (MemberAddToggle) and one difference in what
// saving does: this list is never the admin's personal one (saved via
// groupController.js's createGroupList, which sets CustomList.groupId —
// see that model's own comment), and it replaces whatever list this
// community had pinned before, same as a new poll or challenge would.
export default function GroupListEditorScreen() {
  const { colors } = useTheme();
  useKeyboardSafeExit();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [allowMemberAdd, setAllowMemberAdd] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("Create Community List") });
  }, [navigation, t]);

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
    return () => {
      cancelled = true;
    };
  }, [query]);

  // ---- Suggestions ------------------------------------------------------------------

  const seeds = useMemo(() => suggestionSeeds(items), [items]);
  const currentSeedsKey = seedsKey(seeds);
  const [suggestionPool, setSuggestionPool] = useState<DraftItem[]>([]);
  const [suggesting, setSuggesting] = useState(false);

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
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSuggesting(false);
        });
    }, SUGGESTIONS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSeedsKey]);

  const addedTitles = useMemo(() => new Set(items.map(titleIdentity)), [items]);
  const suggestions = useMemo(
    () => suggestionPool.filter((item) => !addedKeys.has(draftKey(item)) && !addedTitles.has(titleIdentity(item))),
    [suggestionPool, addedKeys, addedTitles]
  );

  // ---- Leaving and saving -------------------------------------------------------------

  const hasDraft = name.trim().length > 0 || description.trim().length > 0 || items.length > 0;
  const changedRef = useRef(hasDraft);
  changedRef.current = hasDraft;
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
  const canSave = trimmedName.length > 0 && !saving && !!slug;

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createGroupList(slug, {
        name: trimmedName,
        description: description.trim(),
        isPublic,
        items: items.map((item) => ({ itemId: item.id, itemType: item.type })),
        allowMemberAdd,
      });
      allowLeave.current = true;
      // The community page's own useFocusEffect reload picks up the new
      // pinned list the moment this screen closes — no local cache to
      // update here, unlike a personal list (myListsCache).
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Failed to create list."));
      setSaving(false);
    }
  }, [canSave, slug, trimmedName, description, isPublic, items, allowMemberAdd, router, showToast, t]);

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
        toggleRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
        toggleHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder, marginTop: 8 },
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
      }),
    [colors, insets.bottom]
  );

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
            autoFocus
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
          <View style={styles.toggleRow}>
            <VisibilityToggle isPublic={isPublic} onChange={setIsPublic} />
            <MemberAddToggle allowMemberAdd={allowMemberAdd} onChange={setAllowMemberAdd} />
          </View>
          <Text style={styles.toggleHint}>
            {allowMemberAdd
              ? t("Members of this community can add titles here — only you can remove one.")
              : t("Only you can add titles to this list.")}
          </Text>
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
              <Text style={styles.saveText}>{t("Create List")}</Text>
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
