import { useMemo, useState } from "react";
import { View, Text, Image, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
// A Modal needs its own gesture root for the app's Pressables to work inside it.
import Modal from "../common/GestureModal";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { createShare } from "../../api/shareService";
import { useRecentShares } from "../../context/RecentSharesContext";
import { useToast } from "../../context/ToastContext";
import type { CollectionEntry } from "../../utils/collectionQuery";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const MIN_ITEMS = 2;
const MAX_ITEMS = 3;
const COLUMNS = 3;

interface Props {
  visible: boolean;
  entries: CollectionEntry[];
  onClose: () => void;
}

// "What should I watch next?" poll — 2 or 3 titles picked from the
// viewer's own Watchlist (the to-watch queue, WatchlistScreen.tsx's own
// config), direct ask ("posterlerle oluşturmayı düşündüm... 2 veya 3 poster
// görünümüne uyumlu halde"). A deliberately separate, simple modal rather
// than a selection mode bolted onto CollectionGrid.tsx — that grid's
// absolutely-positioned/ghost-animation machinery is already intricate,
// and a Watchlist is typically small enough that this plain FlatList grid
// needs none of that virtualization to stay smooth. Reuses `entries`
// already loaded by CollectionScreen.tsx (its own cache) rather than a
// second fetch.
export default function CreatePollModal({ visible, entries, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { announce: announceNewShare } = useRecentShares();
  const { showToast } = useToast();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const [selected, setSelected] = useState<CollectionEntry[]>([]);
  const [creating, setCreating] = useState(false);

  const isSelected = (entry: CollectionEntry) => selected.some((s) => s.id === entry.id && s.type === entry.type);

  const toggle = (entry: CollectionEntry) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === entry.id && s.type === entry.type)) {
        return prev.filter((s) => !(s.id === entry.id && s.type === entry.type));
      }
      if (prev.length >= MAX_ITEMS) return prev; // silently ignored — the tile itself dims out once the cap is hit
      return [...prev, entry];
    });
  };

  const reset = () => {
    setSelected([]);
    setCreating(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (selected.length < MIN_ITEMS) return;
    setCreating(true);
    try {
      const share = await createShare({
        type: "poll",
        items: selected.map((s) => ({ contentId: s.id, contentType: s.type })),
      });
      announceNewShare(share);
      showToast(t("Shared to Media"));
      reset();
      onClose();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.baseContent} />
          </Pressable>
          <Text style={styles.title}>{t("Create Poll")}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.subtitle}>{t("Pick 2 or 3 titles from your Watchlist")}</Text>

        <FlatList
          data={entries}
          numColumns={COLUMNS}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const picked = isSelected(item);
            const pickIndex = selected.findIndex((s) => s.id === item.id && s.type === item.type);
            const atCap = selected.length >= MAX_ITEMS && !picked;
            return (
              <Pressable
                style={[styles.tile, atCap && styles.tileDisabled]}
                onPress={() => toggle(item)}
                disabled={atCap}
              >
                {item.posterPath ? (
                  <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.poster} />
                ) : (
                  <View style={styles.poster} />
                )}
                {picked && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeText}>{pickIndex + 1}</Text>
                  </View>
                )}
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          <Pressable
            style={[styles.createButton, selected.length < MIN_ITEMS && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={selected.length < MIN_ITEMS || creating}
          >
            {creating ? (
              <ActivityIndicator color={colors.primaryContent} size="small" />
            ) : (
              <Text style={styles.createButtonText}>
                {selected.length === 0
                  ? t("Select at least 2 titles")
                  : t("Create Poll ({{count}}/{{max}})", { count: selected.length, max: MAX_ITEMS })}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.base100 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
    subtitle: { fontSize: 13, color: colors.placeholder, textAlign: "center", paddingBottom: 12 },
    grid: { paddingHorizontal: 12, paddingBottom: 100 },
    tile: { flex: 1 / COLUMNS, padding: 6, alignItems: "center" },
    tileDisabled: { opacity: 0.35 },
    poster: {
      width: "100%",
      aspectRatio: 2 / 3,
      borderRadius: 8,
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tileTitle: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 4, textAlign: "center" },
    checkBadge: {
      position: "absolute",
      top: 6,
      right: 12,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.base100,
    },
    checkBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primaryContent },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: colors.base100,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    createButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    createButtonDisabled: { opacity: 0.5 },
    createButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
  });
}
