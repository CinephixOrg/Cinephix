import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { createGroupPoll, type GroupPollItemInput } from "../api/groupService";
import { getCachedSearch, searchTitles } from "../api/listEditorData";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import { SearchResults } from "../components/lists/ListEditorParts";
import { draftKey, type DraftItem } from "../utils/listDraft";
import { fonts } from "../theme/typography";

const PADDING_X = 16;
const SEARCH_DEBOUNCE_MS = 300;
const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const QUESTION_MAX = 150;
const OPTION_TEXT_MAX = 80;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
// The admin's own chosen lifespan — same quick-pick pattern as a
// challenge's own duration, plus "No end date" since not every poll needs
// a cutoff. `null` is that last option.
const DURATION_OPTIONS: (number | null)[] = [1, 3, 7, 14, null];

const MOVE = LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

// Either a catalog pick or the admin's own written text — a community poll
// isn't always "which movie," direct ask: "watch partyi ne zaman yapalım,
// hangi film güzel, hangi filmi izleyelim" are all polls the admin should
// be able to ask, so an option is never forced to resolve to a real title.
type PollDraftOption = { kind: "content"; item: DraftItem } | { kind: "text"; id: string; text: string };

function optionKey(option: PollDraftOption): string {
  return option.kind === "content" ? draftKey(option.item) : option.id;
}

export default function CreatePollScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("New Poll") });
  }, [navigation, t]);

  const [question, setQuestion] = useState("");
  const [durationDays, setDurationDays] = useState<number | null>(7);
  const [options, setOptions] = useState<PollDraftOption[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const textOptionIdRef = useRef(0);

  const contentKeys = useMemo(() => new Set(options.filter((o): o is Extract<PollDraftOption, { kind: "content" }> => o.kind === "content").map((o) => draftKey(o.item))), [options]);

  const addOption = useCallback(
    (option: PollDraftOption) => {
      if (options.length >= MAX_OPTIONS) {
        showToast(t("You can add up to {{count}} options.", { count: MAX_OPTIONS }));
        return;
      }
      LayoutAnimation.configureNext(MOVE);
      setOptions((current) => [...current, option]);
    },
    [options.length, showToast, t]
  );
  const removeOption = useCallback((key: string) => {
    LayoutAnimation.configureNext(MOVE);
    setOptions((current) => current.filter((o) => optionKey(o) !== key));
  }, []);
  const toggleContentOption = useCallback(
    (item: DraftItem) => {
      const key = draftKey(item);
      if (contentKeys.has(key)) removeOption(key);
      else addOption({ kind: "content", item });
    },
    [contentKeys, addOption, removeOption]
  );
  const addTextOption = useCallback(() => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    textOptionIdRef.current += 1;
    addOption({ kind: "text", id: `text-${textOptionIdRef.current}`, text: trimmed });
    setTextDraft("");
  }, [textDraft, addOption]);

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

  const canSave = !saving && options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS;

  const save = useCallback(async () => {
    if (!canSave || !slug) return;
    setSaving(true);
    const items: GroupPollItemInput[] = options.map((o) => (o.kind === "content" ? { contentId: o.item.id, contentType: o.item.type } : { text: o.text }));
    try {
      await createGroupPoll(slug, items, question.trim(), durationDays);
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [canSave, slug, options, question, router, showToast, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { paddingBottom: 140 },
        canvas: { paddingHorizontal: PADDING_X, paddingTop: 18, gap: 6 },
        questionInput: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.baseContent, paddingVertical: 4 },
        hint: { fontSize: 13, color: colors.placeholder, lineHeight: 18, marginTop: 6 },

        section: { paddingHorizontal: PADDING_X, paddingTop: 20, gap: 10 },
        sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, letterSpacing: 0.4 },
        durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        // Soft filled chips instead of the old thick-outlined pills
        // ("çok çirkin görünüyor") — no border, a quieter base200 resting
        // state, and a little shadow on the active one so the current
        // choice actually lifts off the row instead of just swapping color.
        durationPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 14,
          backgroundColor: colors.base200,
        },
        durationPillActive: {
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        durationText: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        durationTextActive: { color: colors.primaryContent },

        optionRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.base200, borderRadius: 12, padding: 10 },
        optionPoster: { width: 36, height: 54, borderRadius: 6, backgroundColor: colors.base300 },
        optionIconWrap: { width: 36, height: 54, borderRadius: 6, backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
        optionText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },

        textInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        textInput: {
          flex: 1,
          fontFamily: fonts.medium,
          fontSize: 14,
          color: colors.baseContent,
          backgroundColor: colors.base200,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        textAddButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
        textAddDisabled: { opacity: 0.4 },

        search: { paddingHorizontal: PADDING_X, paddingTop: 4 },
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
            style={styles.questionInput}
            value={question}
            onChangeText={setQuestion}
            placeholder={t("Ask anything (optional)")}
            placeholderTextColor={colors.placeholder}
            maxLength={QUESTION_MAX}
            multiline
            autoFocus
          />
          <Text style={styles.hint}>{t("Pick 2 to 5 options — members vote for one. Each can be a title or your own text.")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Active for")}</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((days) => {
              const active = days === durationDays;
              const tint = active ? colors.primaryContent : colors.baseContent;
              return (
                <Pressable key={days ?? "unlimited"} style={[styles.durationPill, active && styles.durationPillActive]} onPress={() => setDurationDays(days)}>
                  {days === null ? <Ionicons name="infinite" size={15} color={tint} /> : null}
                  <Text style={[styles.durationText, active && styles.durationTextActive]}>{days === null ? t("No end date") : t("{{count}} days", { count: days })}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {options.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("Options")}</Text>
            {options.map((option) => {
              const key = optionKey(option);
              return (
                <View key={key} style={styles.optionRow}>
                  {option.kind === "content" ? (
                    option.item.posterPath ? (
                      <Image source={{ uri: `${POSTER_BASE}${option.item.posterPath}` }} style={styles.optionPoster} />
                    ) : (
                      <View style={styles.optionIconWrap}>
                        <Ionicons name="film-outline" size={16} color={colors.placeholder} />
                      </View>
                    )
                  ) : (
                    <View style={styles.optionIconWrap}>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.placeholder} />
                    </View>
                  )}
                  <Text style={styles.optionText} numberOfLines={2}>
                    {option.kind === "content" ? option.item.title : option.text}
                  </Text>
                  <Pressable onPress={() => removeOption(key)} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={colors.placeholder} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Write your own option")}</Text>
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.textInput}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder={t("Write something")}
              placeholderTextColor={colors.placeholder}
              maxLength={OPTION_TEXT_MAX}
              onSubmitEditing={addTextOption}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.textAddButton, (!textDraft.trim() || options.length >= MAX_OPTIONS) && styles.textAddDisabled]}
              onPress={addTextOption}
              disabled={!textDraft.trim() || options.length >= MAX_OPTIONS}
            >
              <Ionicons name="add" size={22} color={colors.primaryContent} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("Or choose a movie/series")}</Text>
        </View>
        <View style={styles.search}>
          <CollectionSearchBar placeholder={t("Search movies and series")} onChangeQuery={setQuery} debounceMs={SEARCH_DEBOUNCE_MS} />
        </View>
        {hasQuery ? <SearchResults results={results} searching={searching} addedKeys={contentKeys} onToggle={toggleContentOption} /> : null}
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
              <Text style={styles.saveText}>{t("Create Poll")}</Text>
              <Text style={styles.saveCount}>
                · {options.length}/{MAX_OPTIONS}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
