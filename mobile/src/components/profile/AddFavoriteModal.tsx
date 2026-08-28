import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
}

// Opened by tapping an empty slot (EmptyFavoriteSlot) while a favorites rail
// is in edit mode — pure search-and-tap-to-add, single item at a time, no
// separate Save step. Removal is handled inline on the card itself
// (FavoriteCard's edit-mode overlay), so this modal only ever adds.
export default function AddFavoriteModal({ visible, type, excludeIds, onClose, onAdd }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
        poster: { width: 40, height: 58, borderRadius: 4, backgroundColor: colors.base200 },
        rowLabel: { flex: 1, color: colors.baseContent, fontSize: 14, fontFamily: fonts.medium },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
      }),
    [colors]
  );

  const [query, setQuery] = useState("");
  const [rawResults, setRawResults] = useState<FavoritePickItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (visible) {
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
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={query.trim() ? <Text style={styles.empty}>{t("No results found.")}</Text> : null}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onAdd(item);
                  onClose();
                }}
              >
                {item.poster_path ? (
                  <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
                ) : (
                  <View style={styles.poster} />
                )}
                <Text style={styles.rowLabel} numberOfLines={2}>
                  {item.label}
                </Text>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
