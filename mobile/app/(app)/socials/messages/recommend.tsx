import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import CollectionSearchBar from "../../../../src/components/collection/CollectionSearchBar";
import RecommendFilterSheet, { genreOptionsFor } from "../../../../src/components/socials/RecommendFilterSheet";
import UserSharePickerModal from "../../../../src/components/UserSharePickerModal";
import { SkeletonSearchResultRow } from "../../../../src/components/Skeleton";
import { cachedSearch, searchTitles } from "../../../../src/api/recommendSearch";
import { getOrCreateConversation, sendRichMessage } from "../../../../src/api/conversationService";
import { sendGroupRichMessage } from "../../../../src/api/groupService";
import {
  DEFAULT_RECOMMEND_QUERY,
  formatRating,
  genreNames,
  recommendFilterCount,
  shouldSearch,
  titleOf,
  toPicked,
  yearOf,
  type PickedContent,
  type RecommendQuery,
} from "../../../../src/utils/recommend";
import { useAuth } from "../../../../src/context/AuthContext";
import { useChat } from "../../../../src/context/ChatContext";
import { useToast } from "../../../../src/context/ToastContext";
import { useKeyboardSafeExit } from "../../../../src/hooks/useKeyboardSafeExit";
import type { GenreOption } from "../../../../src/constants/contentGenreIds";
import type { Movie, Series } from "../../../../src/types";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
const FOOTER_HEIGHT = 88;
// A little over React Native's Modal slide-out.
const MODAL_CLOSE_MS = 350;

type Title = Movie | Series;
type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    top: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 10 },
    chips: { gap: 6, alignItems: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 28,
      borderRadius: 14,
      paddingLeft: 11,
      paddingRight: 8,
      backgroundColor: `${colors.primary}22`,
      borderWidth: 1,
      borderColor: `${colors.primary}55`,
    },
    chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
    list: { paddingHorizontal: 10, paddingTop: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: 13, padding: 8, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent" },
    rowPressed: { backgroundColor: colors.base200 },
    rowPicked: { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}66` },
    poster: { width: 48, height: 72, borderRadius: 8, backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
    info: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.baseContent },
    meta: { fontSize: 12.5, color: colors.placeholder },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    rating: { fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent },
    state: { alignItems: "center", paddingTop: 56, paddingHorizontal: 36, gap: 10 },
    stateIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}1A`,
      marginBottom: 6,
    },
    stateTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent, textAlign: "center" },
    stateText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.base100,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
      elevation: 12,
    },
    footerPoster: { width: 36, height: 54, borderRadius: 6, backgroundColor: colors.base200 },
    footerInfo: { flex: 1, minWidth: 0 },
    footerLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder },
    footerTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
    continueButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 46,
      borderRadius: 14,
      paddingHorizontal: 18,
      backgroundColor: colors.primary,
    },
    continueText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
  });
}

type Styles = ReturnType<typeof createStyles>;

const ResultRow = memo(function ResultRow({
  item,
  picked,
  genreOptions,
  onPress,
  styles,
  colors,
}: {
  item: Title;
  picked: boolean;
  genreOptions: GenreOption[];
  onPress: (item: Title) => void;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const year = yearOf(item);
  const genres = genreNames(item.genre_ids, genreOptions)
    .slice(0, 2)
    .map((name) => t(name));
  const meta = [year, genres.join(", ")].filter(Boolean).join("  ·  ");
  const rating = formatRating(item.vote_average);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="radio"
      accessibilityState={{ checked: picked }}
      style={({ pressed }) => [styles.row, picked ? styles.rowPicked : pressed && styles.rowPressed]}
    >
      <View style={styles.poster}>
        {item.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
        ) : (
          <Ionicons name="image-outline" size={18} color={colors.placeholder} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {titleOf(item)}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {rating ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={11} color="#F5B301" />
            <Text style={styles.rating}>{rating}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons
        name={picked ? "checkmark-circle" : "ellipse-outline"}
        size={24}
        color={picked ? colors.primary : colors.border}
      />
    </Pressable>
  );
});

// Pick a movie or series, then who to send it to. Search, type and filters
// share one bar — the Movies/Series choice lives in its filter menu with the
// years and genres, the way the Watched List's does — and any active filter
// shows as a removable chip under it.
export default function RecommendScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  useKeyboardSafeExit();

  const [query, setQuery] = useState<RecommendQuery>(DEFAULT_RECOMMEND_QUERY);
  const [results, setResults] = useState<Title[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picked, setPicked] = useState<PickedContent | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const footer = useRef(new Animated.Value(0)).current;
  // What the footer shows: the pick, or while it slides away, the last one.
  const lastPicked = useRef<PickedContent | null>(null);
  if (picked) lastPicked.current = picked;
  const shownPick = picked ?? lastPicked.current;
  const genreOptions = genreOptionsFor(query.type);
  const filterCount = recommendFilterCount(query);

  const changeText = useCallback((text: string) => setQuery((prev) => (prev.query === text ? prev : { ...prev, query: text })), []);

  // Shows a search's remembered results at once, then refreshes them.
  useEffect(() => {
    if (!shouldSearch(query)) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const cached = cachedSearch(query);
    if (cached) {
      setResults(cached);
      setSearched(true);
    }
    setSearching(!cached);
    let cancelled = false;
    searchTitles(query)
      .then((items) => {
        if (!cancelled) {
          setResults(items);
          setSearched(true);
        }
      })
      .catch(() => {
        if (!cancelled && !cached) {
          setResults([]);
          setSearched(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Leaves only after the recipient picker has finished closing. Popping this
  // screen while the picker's native Modal was still animating out could
  // leave its window behind on Android, invisible but swallowing touches —
  // the Messages tab then needed a dozen taps to register one. Modal's
  // onDismiss would be the exact moment, but it only fires on iOS, so this
  // waits out the slide instead.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => router.back(), MODAL_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [leaving, router]);

  useEffect(() => {
    Animated.timing(footer, {
      toValue: picked ? 1 : 0,
      duration: picked ? 260 : 180,
      easing: picked ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [picked, footer]);

  const pick = useCallback(
    (item: Title) =>
      setPicked((current) => (current?.contentId === item._id ? null : toPicked(item, query.type, genreOptionsFor(query.type)))),
    [query.type]
  );

  const handleConfirmRecipients = async (userIds: string[], groupIds: string[]) => {
    if (!picked || !user) return;
    setSending(true);
    try {
      const text = t("User recommends you", {
        user: user.username,
        title: picked.title,
        type: t(picked.contentType === "movie" ? "movie_acc" : "series_acc"),
      });
      const payload = {
        text,
        type: "recommendation" as const,
        contentType: picked.contentType,
        contentId: picked.contentId,
        contentData: {
          title: picked.title,
          posterUrl: picked.posterUrl,
          genres: picked.genres,
          releaseYear: picked.releaseYear,
          overview: picked.overview,
          rating: picked.rating,
        },
      };
      // allSettled, not all — see ContentDetailScreen.tsx's own
      // handleSendRecommendation for why: each recipient/group has its own
      // independent cooldown, so one already-recommended target shouldn't
      // sink the send to everyone else picked in the same batch.
      const outcomes = await Promise.allSettled([
        ...userIds.map(async (userId) => {
          const conversation = await getOrCreateConversation(userId);
          await sendRichMessage(conversation._id, payload);
        }),
        ...groupIds.map((groupId) => sendGroupRichMessage(groupId, payload)),
      ]);
      const failures = outcomes.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failures.length > 0 && failures.length === outcomes.length) {
        showToast(failures[0].reason?.response?.data?.message || t("Something went wrong. Please try again."));
        return;
      }
      showToast(t("Recommendation sent"));
      refreshConversations();
      // Close the picker first and leave once it's gone (the effect below).
      setPickerVisible(false);
      setLeaving(true);
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const chips = useMemo(() => {
    const list: { key: string; label: string; remove: () => void }[] = [];
    if (query.type === "series") {
      list.push({ key: "type", label: t("Series"), remove: () => setQuery((q) => ({ ...q, type: "movie", genres: [] })) });
    }
    for (const id of query.genres) {
      const genre = genreOptions.find((g) => g.id === id);
      if (genre) {
        list.push({ key: `g${id}`, label: t(genre.name), remove: () => setQuery((q) => ({ ...q, genres: q.genres.filter((g) => g !== id) })) });
      }
    }
    for (const year of query.years) {
      list.push({ key: `y${year}`, label: year, remove: () => setQuery((q) => ({ ...q, years: q.years.filter((y) => y !== year) })) });
    }
    return list;
  }, [query.type, query.genres, query.years, genreOptions, t]);

  const renderItem = useCallback(
    ({ item }: { item: Title }) => (
      <ResultRow
        item={item}
        picked={picked?.contentId === item._id}
        genreOptions={genreOptions}
        onPress={pick}
        styles={styles}
        colors={colors}
      />
    ),
    [picked?.contentId, genreOptions, pick, styles, colors]
  );

  const idle = !shouldSearch(query);
  const footerHeight = FOOTER_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <CollectionSearchBar
          placeholder={t(query.type === "movie" ? "Search movies..." : "Search series...")}
          debounceMs={300}
          onChangeQuery={changeText}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={filterCount}
        />
        {chips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={chip.remove}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${chip.label}, ${t("Remove")}`}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>{chip.label}</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {idle ? (
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="gift-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.stateTitle}>{t("Recommend something great")}</Text>
          <Text style={styles.stateText}>{t("Search for a movie or series, then choose who to send it to.")}</Text>
        </View>
      ) : searching && results.length === 0 ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonSearchResultRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: (picked ? footerHeight : insets.bottom) + 16 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          ListEmptyComponent={
            searched ? (
              <View style={styles.state}>
                <Text style={styles.stateText}>{t(query.type === "movie" ? "No movies found." : "No series found.")}</Text>
              </View>
            ) : null
          }
        />
      )}

      <Animated.View
        pointerEvents={picked ? "auto" : "none"}
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            opacity: footer,
            transform: [{ translateY: footer.interpolate({ inputRange: [0, 1], outputRange: [footerHeight, 0] }) }],
          },
        ]}
      >
        {shownPick?.posterUrl ? (
          <Image source={{ uri: `${POSTER_BASE}${shownPick.posterUrl}` }} style={styles.footerPoster} />
        ) : (
          <View style={styles.footerPoster} />
        )}
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>{t("Recommending")}</Text>
          <Text style={styles.footerTitle} numberOfLines={1}>
            {shownPick?.title ?? ""}
          </Text>
        </View>
        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.continueButton, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.continueText}>{t("Continue")}</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.primaryContent} />
        </Pressable>
      </Animated.View>

      <RecommendFilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} query={query} onChange={setQuery} />

      <UserSharePickerModal
        visible={pickerVisible}
        title={t("Recommend Movie/Series")}
        onClose={() => setPickerVisible(false)}
        sending={sending}
        onConfirm={handleConfirmRecipients}
        allowGroups
      />
    </View>
  );
}
