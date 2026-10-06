import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { createGroupChallenge } from "../api/groupService";
import { getCachedSearch, searchTitles } from "../api/listEditorData";
import { ADDED_COLUMNS, ADDED_GAP, AddedGrid, SearchResults } from "../components/lists/ListEditorParts";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import { addToDraft, draftKey, removeFromDraft, type DraftItem } from "../utils/listDraft";
import { fonts } from "../theme/typography";

const PADDING_X = 16;
const SEARCH_DEBOUNCE_MS = 300;
const TITLE_MAX = 120;
const MIN_ITEMS = 1;
const MAX_ITEMS = 50;
// Quick-pick durations rather than a calendar date picker — no native date-
// picker dependency needed (none exists anywhere else in this app yet, and
// adding one means a native rebuild), and every example this feature was
// designed around ("30 Günde 30 Korku Filmi") is duration-framed anyway.
const DURATION_OPTIONS_DAYS = [7, 14, 30, 60];

const MOVE = LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

// Admin-only: a challenge's fixed title list, picked from the whole
// catalog. Reuses the list editor's own search-and-toggle building blocks
// (ListEditorParts.tsx) rather than a second implementation of that same
// interaction. Community polls used to share this screen too, but moved
// to their own (CreatePollScreen.tsx) once they needed a meaningfully
// different shape — free-text options alongside catalog picks, which
// doesn't make sense for a challenge (progress is computed by intersecting
// real Rating documents, so every item has to resolve to a real title).
export default function GroupContentPickerScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("New Challenge") });
  }, [navigation, t]);

  const [title, setTitle] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const addedKeys = useMemo(() => new Set(items.map(draftKey)), [items]);

  const addItem = useCallback(
    (item: DraftItem) => {
      if (items.length >= MAX_ITEMS) {
        showToast(t("You can pick up to {{count}} titles.", { count: MAX_ITEMS }));
        return;
      }
      LayoutAnimation.configureNext(MOVE);
      setItems((current) => addToDraft(current, item));
    },
    [items.length, showToast, t]
  );
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

  const trimmedTitle = title.trim();
  const canSave = !saving && items.length >= MIN_ITEMS && items.length <= MAX_ITEMS && trimmedTitle.length > 0;

  const save = useCallback(async () => {
    if (!canSave || !slug) return;
    setSaving(true);
    const picked = items.map((item) => ({ contentId: item.id, contentType: item.type }));
    try {
      const deadline = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      await createGroupChallenge(slug, { title: trimmedTitle, items: picked, deadline });
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [canSave, slug, items, durationDays, trimmedTitle, router, showToast, t]);

  const tileWidth = Math.floor((screenWidth - PADDING_X * 2 - ADDED_GAP * (ADDED_COLUMNS - 1)) / ADDED_COLUMNS);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { paddingBottom: 140 },
        canvas: { paddingHorizontal: PADDING_X, paddingTop: 18, gap: 12 },
        titleInput: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.baseContent, paddingVertical: 4 },
        hint: { fontSize: 13, color: colors.placeholder, lineHeight: 18 },
        durationRow: { flexDirection: "row", gap: 8 },
        durationPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border },
        durationPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        durationText: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        durationTextActive: { color: colors.primaryContent },
        search: { paddingHorizontal: PADDING_X, paddingTop: 10 },
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.canvas}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t("Challenge title")}
            placeholderTextColor={colors.placeholder}
            maxLength={TITLE_MAX}
            autoFocus
            returnKeyType="next"
          />
          <Text style={styles.hint}>{t("Members' own progress is based on what they've already rated.")}</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS_DAYS.map((days) => {
              const active = days === durationDays;
              return (
                <Pressable key={days} style={[styles.durationPill, active && styles.durationPillActive]} onPress={() => setDurationDays(days)}>
                  <Text style={[styles.durationText, active && styles.durationTextActive]}>{t("{{count}} days", { count: days })}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.search}>
          <CollectionSearchBar placeholder={t("Search movies and series")} onChangeQuery={setQuery} debounceMs={SEARCH_DEBOUNCE_MS} />
        </View>

        {hasQuery ? <SearchResults results={results} searching={searching} addedKeys={addedKeys} onToggle={toggleItem} /> : null}

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
              <Text style={styles.saveText}>{t("Create Challenge")}</Text>
              <Text style={styles.saveCount}>· {items.length}</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
