import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Modal, ScrollView, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getUserShares, toggleShareLike, SHARES_PREVIEW_LIMIT } from "../../api/shareService";
import ShareCard from "../ShareCard";
import ShareGridTile from "./ShareGridTile";
import type { Share } from "../../types";
import { useTheme } from "../../context/ThemeContext";


// How long a fetched share list is treated as current when this tab is
// brought back into view. Short, because posting a share is exactly the
// thing a user does right before coming here to look at it.
const REVALIDATE_TTL_MS = 15_000;
const SHARINGS_COLUMNS = 3;
const SHARINGS_GAP = 6;
const SHARINGS_PADDING = 16;

// Shares category body, shared by own profile (default userId="me") and
// public profile (explicit userId) — simple capped list (no infinite
// scroll) inside the parent ScrollView, matching how the other category
// bodies (Favorites/CineGraph[/Analyses on own profile]) already render in
// place without their own pagination. Renders as a wrapping 3-column grid
// (plain View, not FlatList — a nested FlatList inside the parent
// ScrollView would trigger RN's VirtualizedList warning) of square
// ShareGridTile thumbnails; tapping one opens the real, full ShareCard in a
// Modal, mirroring ProfileAnalysisModal.tsx's existing
// tap-thumbnail-to-expand pattern.
interface Props {
  userId?: string;
  basePath?: "/home" | "/profile" | `/user/${string}`;
  // Whether this tab is the one currently on screen. Only the own-profile
  // caller keeps it mounted while hidden, so everywhere else this stays
  // true and the revalidation below is a no-op.
  active?: boolean;
  // Shares already fetched by the caller. The public profile pulls these in
  // the same round trip as the rest of its bundle, so this tab — the default
  // one — has content on its first frame instead of mounting, firing its own
  // request, and showing a spinner after the profile had already loaded.
  initialShares?: Share[];
}

function ProfileSharingsTab({ userId = "me", basePath = "/profile", active = true, initialShares }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [shares, setShares] = useState<Share[]>(initialShares ?? []);
  const [loading, setLoading] = useState(!initialShares);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  // Pre-seeded shares count as freshly fetched — they came from the caller's
  // own request moments ago, so the revalidation below shouldn't immediately
  // repeat it.
  const lastFetchedRef = useRef(initialShares ? Date.now() : 0);

  // Measured off the grid's own onLayout rather than assumed from
  // useWindowDimensions — the grid's actual available width can end up
  // narrower than the full device width depending on where this tab is
  // mounted, and computing tile size from a too-wide assumption is what
  // silently drops the row from 3 tiles to 2 (the 3rd tile no longer fits
  // in the real space, so it wraps, leaving a gap on the right instead of a
  // symmetric row). Starts from the screenWidth-based estimate so the very
  // first frame isn't 0-width, then locks onto the real measurement.
  const [gridWidth, setGridWidth] = useState(screenWidth);
  const handleGridLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    setGridWidth((prev) => (prev === width ? prev : width));
  };
  const tileSize = (gridWidth - SHARINGS_PADDING * 2 - SHARINGS_GAP * (SHARINGS_COLUMNS - 1)) / SHARINGS_COLUMNS;

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

  const load = useCallback(
    (withSpinner: boolean) => {
      if (withSpinner) setLoading(true);
      let cancelled = false;
      getUserShares(userId, 1, SHARES_PREVIEW_LIMIT)
        .then((res) => {
          if (cancelled) return;
          setShares(res.items);
          lastFetchedRef.current = Date.now();
        })
        .finally(() => {
          if (!cancelled && withSpinner) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [userId]
  );

  // Skipped entirely when the caller handed us shares: there's nothing to
  // wait for, and the revalidate-on-active effect below keeps them current.
  const seededRef = useRef(Boolean(initialShares));
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      return;
    }
    return load(true);
  }, [load]);

  // This tab stays mounted once visited (ProfileCategoryTabs keeps it alive
  // so switching back is instant), which means the one fetch above would
  // otherwise be the only one for the whole session — a share posted in the
  // meantime would never show up here. Revalidating when the tab is brought
  // back gives the freshness the old remount-every-time behaviour had, minus
  // its cost: no spinner and no cleared list, because there's already
  // something correct on screen to keep showing while the request runs.
  useEffect(() => {
    if (!active) return;
    if (Date.now() - lastFetchedRef.current < REVALIDATE_TTL_MS) return;
    return load(false);
  }, [active, load]);

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
        <View style={styles.grid} onLayout={handleGridLayout}>
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
              {selectedShare && <ShareCard share={selectedShare} onToggleLike={handleToggleLike} basePath={basePath} />}
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

// Memoized for the same reason as the CineGraph tab: it stays mounted after
// its first visit, and re-rendering its whole share grid on every unrelated
// profile-screen render would give back what keeping it mounted just saved.
export default memo(ProfileSharingsTab);
