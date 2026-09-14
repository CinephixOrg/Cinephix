import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
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

export function createTileStyles(colors: { base300: string }) {
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
        <View style={styles.poster}>
          {uri ? (
            <Animated.Image source={{ uri }} style={[styles.fill, { opacity: imageOpacity }]} onLoad={onImageLoad} />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="film-outline" size={20} color={placeholderColor} />
            </View>
          )}
        </View>

        {editable ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { opacity: editProgress, transform: [{ scale: overlayScale }] }]}
          >
            <View style={styles.removeButton}>
              <Ionicons name="close" size={20} color="#fff" />
            </View>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// Every prop is a primitive or a reference the grid keeps stable, so a tile
// re-renders only when its own position, entry or mode changes.
export default memo(CollectionPosterTile);
