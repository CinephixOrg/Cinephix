import { useEffect, useState, useMemo } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getFavorites, updateFavorites } from "../api/favoriteService";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w200";

interface FavoriteItem {
  id: string;
  title: string;
  posterPath?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  type: ContentType;
  currentItem: FavoriteItem;
  myUserId: string;
  onSaved: (isFavoriteNow: boolean) => void;
}

export default function FavoritesModal({ visible, onClose, type, currentItem, myUserId, onSaved }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: colors.base200, borderRadius: 12, padding: 20, maxHeight: "70%" },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, marginBottom: 12 },
  modalList: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  thumb: { width: 40, height: 60, borderRadius: 6, backgroundColor: colors.base300 },
  thumbFallback: { backgroundColor: colors.base300 },
  rowLabel: { flex: 1, color: colors.baseContent, fontSize: 14 },
  error: { color: colors.error, fontSize: 12, marginTop: 8 },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold },
}), [colors]);
  const { t } = useTranslation();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const favorites = await getFavorites(myUserId);
        const existing: FavoriteItem[] = favorites.isAuthorized
          ? type === "movie"
            ? favorites.movies.map((m) => ({ id: m._id, title: m.title, posterPath: m.poster_path }))
            : favorites.series.map((s) => ({ id: s._id, title: s.name, posterPath: s.poster_path }))
          : [];
        const union = existing.some((it) => it.id === currentItem.id)
          ? existing
          : [...existing, currentItem];
        setItems(union);
      } catch {
        setItems([currentItem]);
        setError(t("Couldn't load your current favorites — showing only this item."));
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, myUserId, type]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const overCap = items.length > 5;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateFavorites(
        type,
        items.map((it) => it.id)
      );
      onSaved(items.some((it) => it.id === currentItem.id));
      onClose();
    } catch {
      setError(t("Failed to save favorites."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t("Manage Favorites")}</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  {item.posterPath ? (
                    <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]} />
                  )}
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={colors.placeholder} />
                  </Pressable>
                </View>
              )}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {overCap && <Text style={styles.error}>{t("You can have at most 5 favorites.")}</Text>}

          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>{t("Cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, (overCap || saving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={overCap || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryContent} />
              ) : (
                <Text style={styles.saveButtonText}>{t("Save")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

