import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Modal, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getUserShares, toggleShareLike } from "../../api/shareService";
import ShareCard from "../ShareCard";
import ShareGridTile from "./ShareGridTile";
import type { Share } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const PREVIEW_LIMIT = 30;
const SHARINGS_COLUMNS = 3;
const SHARINGS_GAP = 6;
const SHARINGS_PADDING = 16;

// Own-profile's "Your Sharings" category body — simple capped list (no
// infinite scroll) inside the parent ScrollView, matching how the other 3
// category bodies (Favorites/CineGraph/Analyses) already render in place
// without their own pagination. Renders as a wrapping 3-column grid (plain
// View, not FlatList — a nested FlatList inside the parent ScrollView would
// trigger RN's VirtualizedList warning) of square ShareGridTile thumbnails;
// tapping one opens the real, full ShareCard in a Modal, mirroring
// ProfileAnalysisModal.tsx's existing tap-thumbnail-to-expand pattern.
export default function ProfileSharingsTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);

  const tileSize = (screenWidth - SHARINGS_PADDING * 2 - SHARINGS_GAP * (SHARINGS_COLUMNS - 1)) / SHARINGS_COLUMNS;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: SHARINGS_PADDING, paddingTop: 8 },
        // Horizontal inset matches the feed FlatList's own 16px padding
        // (SharesFeedSection.tsx's `list` style) so ShareCard's full-bleed
        // poster (negative-margined by that same 16px) lines up correctly
        // in both contexts.
        modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 20 },
        modalContent: { maxHeight: "85%" },
        modalClose: {
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors]
  );

  useEffect(() => {
    let cancelled = false;
    getUserShares("me", 1, PREVIEW_LIMIT)
      .then((res) => {
        if (!cancelled) setShares(res.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleLike = async (shareId: string) => {
    const prev = shares;
    setShares((cur) =>
      cur.map((s) => (s._id !== shareId ? s : { ...s, liked: !s.liked, likeCount: s.liked ? Math.max(0, s.likeCount - 1) : s.likeCount + 1 }))
    );
    try {
      await toggleShareLike(shareId);
    } catch {
      setShares(prev);
    }
  };

  const selectedShare = shares.find((s) => s._id === selectedShareId) ?? null;

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />;
  }

  return (
    <View>
      {shares.length === 0 ? (
        <Text style={{ textAlign: "center", color: colors.placeholder, marginTop: 24 }}>{t("No shares yet.")}</Text>
      ) : (
        <View style={styles.grid}>
          {shares.map((share, index) => (
            <ShareGridTile
              key={share._id}
              share={share}
              size={tileSize}
              onPress={() => setSelectedShareId(share._id)}
              style={{
                marginRight: (index + 1) % SHARINGS_COLUMNS === 0 ? 0 : SHARINGS_GAP,
                marginBottom: SHARINGS_GAP,
              }}
            />
          ))}
        </View>
      )}

      <Modal visible={!!selectedShare} transparent animationType="fade" onRequestClose={() => setSelectedShareId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedShare && <ShareCard share={selectedShare} onToggleLike={() => handleToggleLike(selectedShare._id)} basePath="/profile" />}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setSelectedShareId(null)}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
