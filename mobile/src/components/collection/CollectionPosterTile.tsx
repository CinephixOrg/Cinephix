import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import type { CollectionEntry } from "../../utils/collectionQuery";

// A tile five-across is about 70pt wide. w185 is already more than twice that
// at 3x density; w342, which the larger cards use, would triple the bytes for
// no visible difference.
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

export const GLIDE_MS = 240;
export const EXIT_MS = 200;

// Posters already shown once this session. A tile that mounts again for one
// (scrolling back to it, clearing a filter) shows it straight away instead of
// fading it in from blank.
const shownPosters = new Set<string>();

/** glide: animate to a new position. snap: jump there. */
export type TileMotion = "glide" | "snap";

export function createTileStyles(colors: { base300: string; base100: string; primary: string; primaryContent: string }) {
  return StyleSheet.create({
    cell: { position: "absolute", left: 0, top: 0 },
    fill: { flex: 1 },
    pressed: { transform: [{ scale: 0.95 }] },
    poster: { flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: colors.base300 },
    fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      backgroundColor: "rgba(220,38,38,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    removeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    // Poll-selection mode (Watchlist's own "what should I watch next?" poll
    // — direct ask, replacing a separate modal with its own duplicate grid:
    // "var olan watchlist kart dizliminden seçilsin... bir moda girmek gibi
    // düşün"). Same numbered-badge language CreatePollModal.tsx's own
    // checkBadge used, so this reads as the same feature even though it no
    // longer lives in a separate screen.
    selectedOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      borderWidth: 3,
      borderColor: colors.primary,
    },
    selectedBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.base100,
    },
    selectedBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primaryContent },
    dimmed: { opacity: 0.4 },
  });
}

export type TileStyles = ReturnType<typeof createTileStyles>;

interface Props {
  entry: CollectionEntry;
  x: number;
  y: number;
  width: number;
  height: number;
  editing: boolean;
  /** Whether this grid can edit at all. A read-only tile renders no remove overlay and never removes. */
  editable: boolean;
  /**
   * One value shared by every tile, animated 0 -> 1 when edit mode turns on,
   * with its scale interpolation built once by the grid. Entering edit mode is
   * then a single native animation rather than one per poster.
   */
  editProgress: Animated.Value;
  overlayScale: Animated.AnimatedInterpolation<number>;
  motion: TileMotion;
  /** Fade and scale in on mount (a title put back by Undo). Read on mount only. */
  appearing: boolean;
  /** Just removed: play the exit, ignore taps. */
  leaving: boolean;
  onOpen: (entry: CollectionEntry) => void;
  onRemove: (entry: CollectionEntry) => void;
  styles: TileStyles;
  placeholderColor: string;
  removeLabel: string;
  /** Poll-selection mode (Watchlist only) — mutually exclusive with `editing`
   * in practice (CollectionScreen never shows both entry points at once). A
   * tap toggles selection instead of opening/removing; `selectionIndex`
   * (1-based) is shown in a numbered badge once picked, and a tile neither
   * selected nor pickable once the 3-item cap is hit dims out, same
   * behavior CreatePollModal.tsx's own grid used before this replaced it. */
  selectionMode?: boolean;
  selected?: boolean;
  selectionIndex?: number | null;
  selectionAtCap?: boolean;
  onToggleSelect?: (entry: CollectionEntry) => void;
}

// One poster in a collection grid.
//
// Its position is a native-driven translate, never a layout property. So a
// move is one animation on the UI thread with no layout pass, and a tile
// keeps its identity — and its already-decoded poster — wherever it goes.
//
// Edit mode is the Profile Favorites design: a translucent red wash over the
// poster with a centred close button. The whole tile is the tap target rather
// than just the button, since at five across the button alone would be too
// small to hit reliably.
function CollectionPosterTile({
  entry,
  x,
  y,
  width,
  height,
  editing,
  editable,
  editProgress,
  overlayScale,
  motion,
  appearing,
  leaving,
  onOpen,
  onRemove,
  styles,
  placeholderColor,
  removeLabel,
  selectionMode = false,
  selected = false,
  selectionIndex = null,
  selectionAtCap = false,
  onToggleSelect,
}: Props) {
  const translateX = useRef(new Animated.Value(x)).current;
  const translateY = useRef(new Animated.Value(y)).current;
  const presence = useRef(new Animated.Value(appearing ? 0 : 1)).current;
  const scale = useMemo(() => presence.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), [presence]);

  // Before paint, so a snap never shows a frame at the old position.
  const placed = useRef({ x, y });
  useLayoutEffect(() => {
    if (placed.current.x === x && placed.current.y === y) return;
    placed.current = { x, y };
    if (motion === "glide") {
      // Starting from wherever the tile is right now, so a second removal
      // mid-glide redirects it smoothly instead of restarting.
      const config = { duration: GLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true };
      Animated.parallel([
        Animated.timing(translateX, { ...config, toValue: x }),
        Animated.timing(translateY, { ...config, toValue: y }),
      ]).start();
    } else {
      translateX.stopAnimation();
      translateY.stopAnimation();
      translateX.setValue(x);
      translateY.setValue(y);
    }
  }, [x, y, motion, translateX, translateY]);

  // `appearing` is deliberately read on mount only: after that, presence
  // follows `leaving` alone.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!appearing) return;
    }
    Animated.timing(presence, {
      toValue: leaving ? 0 : 1,
      duration: EXIT_MS,
      easing: leaving ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, presence]);

  const uri = entry.posterPath ? `${POSTER_BASE}${entry.posterPath}` : null;
  const imageOpacity = useMemo(() => new Animated.Value(uri && shownPosters.has(uri) ? 1 : 0), [uri]);
  const onImageLoad = () => {
    if (!uri || shownPosters.has(uri)) return;
    shownPosters.add(uri);
    Animated.timing(imageOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  };

  const onPress = () => {
    if (leaving) return;
    if (selectionMode) {
      if (selectionAtCap && !selected) return;
      onToggleSelect?.(entry);
      return;
    }
    if (editing && editable) onRemove(entry);
    else onOpen(entry);
  };

  return (
    <Animated.View
      pointerEvents={leaving ? "none" : "auto"}
      style={[
        styles.cell,
        { width, height, opacity: presence, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={editing && editable ? `${removeLabel}, ${entry.title}` : entry.title}
        style={({ pressed }) => [styles.fill, pressed && styles.pressed]}
      >
        <View style={[styles.poster, selectionMode && selectionAtCap && !selected && styles.dimmed]}>
          {uri ? (
            <Animated.Image source={{ uri }} style={[styles.fill, { opacity: imageOpacity }]} onLoad={onImageLoad} />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="film-outline" size={20} color={placeholderColor} />
            </View>
          )}
        </View>

        {editable && !selectionMode ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { opacity: editProgress, transform: [{ scale: overlayScale }] }]}
          >
            <View style={styles.removeButton}>
              <Ionicons name="close" size={20} color="#fff" />
            </View>
          </Animated.View>
        ) : null}

        {selectionMode && selected ? (
          <>
            <View pointerEvents="none" style={styles.selectedOverlay} />
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>{selectionIndex != null ? selectionIndex + 1 : ""}</Text>
            </View>
          </>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// Every prop is a primitive or a reference the grid keeps stable, so a tile
// re-renders only when its own position, entry or mode changes.
export default memo(CollectionPosterTile);
