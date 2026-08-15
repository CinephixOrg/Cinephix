import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, FlatList, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getRejectedMatches, swipeMatch } from "../../api/matchService";
import { useToast } from "../../context/ToastContext";
import type { RejectedMatchEntry } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Pro/Premium/Dev only — the caller is responsible for not rendering the
// entry point (button/icon) that opens this for Free, but the backend also
// enforces it independently (returns [] for Free rather than an error).
export default function RejectedMatchesModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<RejectedMatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getRejectedMatches()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleUndo = async (entry: RejectedMatchEntry) => {
    setUndoingId(entry.user._id);
    try {
      await swipeMatch(entry.user._id, entry.contentType, "accept", entry.matchPercentage);
      setEntries((prev) => prev.filter((e) => e.user._id !== entry.user._id));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setUndoingId(null);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: { backgroundColor: colors.base200, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
        avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
        rowInfo: { flex: 1 },
        username: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        meta: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
        undoButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.base300,
          alignItems: "center",
          justifyContent: "center",
        },
        empty: { textAlign: "center", color: colors.placeholder, padding: 32 },
      }),
    [colors]
  );

  const formatDaysAgo = (iso: string) => {
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)));
    return days === 0 ? t("Today") : t("{{count}}d ago", { count: days });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("Rejected")}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.user._id}
              ListEmptyComponent={
                <Text style={styles.empty}>{t("You haven't rejected anyone recently.")}</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  {item.user.profile_pic_url ? (
                    <Image source={{ uri: item.user.profile_pic_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {item.user.username.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={styles.username} numberOfLines={1}>
                      {item.user.username}
                    </Text>
                    <Text style={styles.meta}>
                      {item.matchPercentage}% · {formatDaysAgo(item.rejectedAt)}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.undoButton}
                    onPress={() => handleUndo(item)}
                    disabled={undoingId === item.user._id}
                  >
                    {undoingId === item.user._id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="heart" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
