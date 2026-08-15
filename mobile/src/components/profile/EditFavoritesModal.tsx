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
import { updateFavorites } from "../../api/favoriteService";
import type { ContentType, FavoriteMovie, FavoriteSeries } from "../../types";
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
  favorites: (FavoriteMovie | FavoriteSeries)[];
  onClose: () => void;
  onSaved: (type: ContentType, items: FavoritePickItem[]) => void;
}

// NOTE: exact visual layout is a placeholder pending the reference design —
// functionally complete (search, add/remove, save) but not yet pixel-matched
// to any provided mockup.
export default function EditFavoritesModal({ visible, type, favorites, onClose, onSaved }: Props) {
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
        sectionLabel: {
          fontFamily: fonts.medium,
          fontSize: 12,
          color: colors.placeholder,
          paddingHorizontal: 16,
          marginBottom: 8,
        },
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
        saveButton: {
          margin: 16,
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
      }),
    [colors]
  );

  const toPickItem = (f: FavoriteMovie | FavoriteSeries): FavoritePickItem =>
    type === "movie"
      ? { _id: f._id, label: (f as FavoriteMovie).title, poster_path: f.poster_path }
      : { _id: f._id, label: (f as FavoriteSeries).name, poster_path: f.poster_path };

  const [selected, setSelected] = useState<FavoritePickItem[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoritePickItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(favorites.map(toPickItem));
      setQuery("");
      setResults([]);
    }
    // Re-seed only when the modal opens (or target type changes) — not on
    // every `favorites` prop change, so mid-edit selections aren't clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
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
        setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, type]);

  const isSelected = (id: string) => selected.some((s) => s._id === id);

  const toggle = (item: FavoritePickItem) => {
    setSelected((prev) => (isSelected(item._id) ? prev.filter((s) => s._id !== item._id) : [...prev, item]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFavorites(type, selected.map((s) => s._id));
      onSaved(type, selected);
      onClose();
    } catch {
      // Best-effort — leave the modal open/editable on failure rather than
      // silently discarding the user's selection.
    } finally {
      setSaving(false);
    }
  };

  const title = type === "movie" ? t("Edit Favorite Movies") : t("Edit Favorite Series");
  const isSearching = query.trim().length > 0;
  const list = isSearching ? results : selected;

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
          />
        </View>

        {!isSearching && (
          <Text style={styles.sectionLabel}>
            {`${t("Your favorites")} (${selected.length})`.toUpperCase()}
          </Text>
        )}

        {searching ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {isSearching ? t("No results found.") : t("You haven't added any favorites yet.")}
              </Text>
            }
            renderItem={({ item }) => {
              const active = isSelected(item._id);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item)}>
                  {item.poster_path ? (
                    <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
                  ) : (
                    <View style={styles.poster} />
                  )}
                  <Text style={styles.rowLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Ionicons
                    name={active ? "checkmark-circle" : "add-circle-outline"}
                    size={24}
                    color={active ? colors.primary : colors.placeholder}
                  />
                </Pressable>
              );
            }}
          />
        )}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.primaryContent} />
          ) : (
            <Text style={styles.saveButtonText}>{t("Save")}</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
