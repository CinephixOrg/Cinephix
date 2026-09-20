import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
// Its gesture root comes with it (a Modal is its own native window).
import Modal from "../common/GestureModal";
import Pressable from "../common/TapSafePressable";
// FlatList + touchables come from gesture-handler, not react-native: RN's
// own touch-responder path never delivered a first tap here while the
// keyboard was up (it was consumed by keyboard dismissal before reaching
// the row, regardless of keyboardShouldPersistTaps). Gesture-handler's
// versions recognize touches natively instead of going through that
// negotiation, so a single tap lands. They work inside a Modal because
// common/GestureModal gives every Modal its own gesture root.
import {
  FlatList as GHFlatList,
  TouchableOpacity as GHTouchableOpacity,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getMovies, getSeries } from "../../api/contentService";
import type { ContentType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const SEARCH_DEBOUNCE_MS = 400;

export interface FavoritePickItem {
  _id: string;
  label: string;
  poster_path?: string | null;
}

interface Props {
  visible: boolean;
  type: ContentType;
  // Already-favorited ids for this type — filtered out of search results so
  // there's no way to "add" something already in the list.
  excludeIds: string[];
  onClose: () => void;
  onAdd: (item: FavoritePickItem) => void;
  // Where a result's poster/title tap navigates for a closer look (rate,
  // review, or just confirm "is this the right one") — only own-profile
  // uses this modal today, so this defaults there.
  basePath?: "/profile" | `/user/${string}`;
}

// Opened by tapping an empty slot (EmptyFavoriteSlot) while a favorites rail
// is in edit mode — search-and-tap-to-add, single item at a time, no
// separate Save step. Removal is handled inline on the card itself
// (FavoriteCard's edit-mode overlay), so this modal only ever adds. A
// result row has two independent tap targets: the poster/title opens that
// title's own Content Detail page (rating/reviewing something you're only
// half-sure about shouldn't require leaving this search first), while only
// the "+" icon actually adds it to favorites.
export default function AddFavoriteModal({ visible, type, excludeIds, onClose, onAdd, basePath = "/profile" }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          margin: 16,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: colors.base200,
        },
        searchInput: { flex: 1, color: colors.baseContent, fontSize: 15 },
        list: { paddingHorizontal: 16, paddingBottom: 24 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 8,
        },
        // gesture-handler's TouchableOpacity renders two nested views: the
        // outer one (containerStyle) is what actually participates in this
        // row's layout, the inner one (style) just wraps the children. The
        // flex:1 that makes the title fill the space between poster and "+"
        // has to go on the outer one — putting it on `style` alone let the
        // container shrink to content width, which squeezed the title to
        // nothing and pulled "+" up against the poster.
        rowMainContainer: { flex: 1 },
        rowMain: { flexDirection: "row", alignItems: "center", gap: 12 },
        poster: { width: 40, height: 58, borderRadius: 4, backgroundColor: colors.base200 },
        rowLabel: { flex: 1, color: colors.baseContent, fontSize: 14, fontFamily: fonts.medium },
        addButton: { padding: 4 },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
      }),
    [colors]
  );

  const [query, setQuery] = useState("");
  const [rawResults, setRawResults] = useState<FavoritePickItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Set right before navigating to a result's Content Detail page (see the
  // poster/title Pressable below) — the caller hides this modal (visible
  // flips false) without calling onClose while that happens, purely
  // because RN's Modal renders above the whole nav stack and would
  // otherwise hide the newly-pushed screen; it isn't a real dismissal, so
  // the next `visible: false -> true` transition (landing back here) should
  // leave the search query/results exactly as they were instead of
  // clearing them like a genuinely fresh open does.
  const preserveOnReopenRef = useRef(false);

  useEffect(() => {
    if (visible) {
      if (preserveOnReopenRef.current) {
        preserveOnReopenRef.current = false;
        return;
      }
      setQuery("");
      setRawResults([]);
    }
  }, [visible]);

  // Deliberately depends only on [query, type] — NOT excludeIds. The
  // caller passes excludeIds as a freshly-computed array on every one of
  // its own re-renders (unmemoized), so including it here re-ran this
  // effect constantly: every unrelated parent re-render restarted the
  // debounce timer and flipped `searching` back to true, swapping the
  // FlatList out for a spinner mid-tap — a tap that happened to land
  // during that flicker was silently swallowed, which is exactly what
  // "have to tap twice" looks like. Excluding already-favorited items is
  // now a cheap derived filter below instead, so it can never affect
  // whether a network request fires or the list remounts.
  useEffect(() => {
    if (!query.trim()) {
      setRawResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = type === "movie" ? await getMovies(1, 20, query) : await getSeries(1, 20, query);
        if (cancelled) return;
        const items: FavoritePickItem[] = res.items.map((entry: any) =>
          type === "movie"
            ? { _id: entry._id, label: entry.title, poster_path: entry.poster_path }
            : { _id: entry._id, label: entry.name, poster_path: entry.poster_path }
        );
        setRawResults(items);
      } catch {
        if (!cancelled) setRawResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, type]);

  const results = useMemo(
    () => rawResults.filter((item) => !excludeIds.includes(item._id)),
    [rawResults, excludeIds]
  );

  const title = type === "movie" ? t("Favorite Movies") : t("Favorite Series");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* RN's Modal is its own separate native window, so it doesn't
            inherit the app's normal keyboard-resize behavior the way a
            regular screen does — without this the keyboard just overlaps
            the results instead of the list shrinking to make room. */}
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("Close")}>
            <Ionicons name="close" size={24} color={colors.baseContent} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.placeholder} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={type === "movie" ? t("Search movies") : t("Search series")}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoFocus
          />
        </View>

        {searching ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : (
          <GHFlatList
            data={results}
            keyExtractor={(item) => (item as FavoritePickItem)._id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="always"
            ListEmptyComponent={query.trim() ? <Text style={styles.empty}>{t("No results found.")}</Text> : null}
            renderItem={({ item }) => {
              const result = item as FavoritePickItem;
              return (
                <View style={styles.row}>
                  <GHTouchableOpacity
                    containerStyle={styles.rowMainContainer}
                    style={styles.rowMain}
                    activeOpacity={0.7}
                    onPress={() => {
                      Keyboard.dismiss();
                      preserveOnReopenRef.current = true;
                      router.push(`${basePath}/content/${type}/${result._id}` as any);
                    }}
                  >
                    {result.poster_path ? (
                      <Image source={{ uri: `${POSTER_BASE}${result.poster_path}` }} style={styles.poster} />
                    ) : (
                      <View style={styles.poster} />
                    )}
                    <Text style={styles.rowLabel} numberOfLines={2}>
                      {result.label}
                    </Text>
                  </GHTouchableOpacity>
                  <GHTouchableOpacity
                    style={styles.addButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      Keyboard.dismiss();
                      onAdd(result);
                      onClose();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={t("Add")}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </GHTouchableOpacity>
                </View>
              );
            }}
          />
        )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
