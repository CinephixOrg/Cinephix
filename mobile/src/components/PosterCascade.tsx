import { useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const ASPECT_RATIO = 1.5; // width:height 2:3, matches every poster elsewhere in this app
export const CASCADE_POSTER_RADIUS = 8;
// Must clear CASCADE_POSTER_RADIUS with room to spare — the sliver each
// back card reveals is its own rounded edge, and an offset ≤ the radius
// reveals only corner curve, no straight edge (the exact bug the first
// vertical cascade attempt hit at offset:8 == radius:8).
export const CASCADE_OFFSET_STEP = 10;
// Graduated fade for back layers (dimBackLayers) — each step back gets a
// little more transparent than the one in front of it, reading as real
// depth rather than one flat dark mask on every back layer alike. Only 5
// entries needed since maxStack never exceeds 5 for a graduated (non-
// fitToWidth) cascade; index 0 (the front layer) is never faded regardless.
const BACK_LAYER_OPACITY = [1, 0.72, 0.5, 0.32, 0.18];

export function posterHeightFor(posterWidth: number) {
  return posterWidth * ASPECT_RATIO;
}

export interface CascadeItem {
  itemId: string;
  itemType: string;
  poster_path?: string;
  title: string;
}

interface Props {
  items: CascadeItem[];
  // "vertical" cascades downward (each item offset further down, drawn
  // behind the one above it) — Discover's Popular Lists rail.
  // "horizontal" cascades rightward (each item offset further right, drawn
  // behind the one to its left) — ShareCard's list-post box.
  direction: "vertical" | "horizontal";
  posterWidth?: number;
  // Ignored when fitToWidth is set. Default 5.
  maxStack?: number;
  // Horizontal only: instead of a fixed maxStack, stacks as many items as
  // actually fit the row's real available width (measured via onLayout on
  // this component's own outer container, which is given width:"100%" so
  // it receives whatever space its parent's flow allows) — per the user's
  // own ask for ShareCard's list-post box specifically: "satıra ne kadar
  // sığıyorsa o kadar diz", not a fixed cap. Renders just the front item
  // until the first layout pass reports a real width, to avoid a one-frame
  // overflow past the row's actual bounds.
  fitToWidth?: boolean;
  // Shows a corner badge (stack icon + this number) on the front poster
  // when provided — omit it where the item count is already shown
  // elsewhere on the same card (e.g. ShareCard's own listCount text)
  // to avoid showing the same number twice.
  itemCount?: number;
  // Every layer gets this border by default (colors.border — the app's
  // real semantic border token, distinct from the "Detail" pill's own
  // primary color, per direct correction: a prior round tried matching the
  // pill's color and the user reversed that call) — pass 0 to turn it off
  // entirely (ShareCard's list-post box wants its old plain-thumbnail look
  // back, no frame at all, per an earlier, separate correction: "rengi
  // değiştir derken sadece discoverdaki list kısmından bahsediyordum").
  borderWidth?: number;
  borderColor?: string;
  // Fades every layer BEHIND the front one, each step further back a
  // little more transparent than the last (BACK_LAYER_OPACITY) — a real
  // depth cue instead of a single flat dark mask on every back layer
  // alike. Front layer is always fully opaque; only meaningful when a
  // caller (ListRailCard) separately renders its own interactive overlay
  // on the front layer.
  dimBackLayers?: boolean;
}

// A solitaire-style poster cascade — up to `maxStack` posters (or, in
// fitToWidth mode, however many actually fit) stacked with a slight
// offset, each drawn in front of the one before it, so the front item
// (items[0]) is fully visible and the rest peek out from behind it. Shared
// by ListRailCard.tsx (vertical, Discover's Popular Lists rail) and
// ShareCard.tsx's list-post box (horizontal) so both stay visually
// identical as this design keeps iterating, instead of two copies of the
// same offset/border/badge math drifting apart over time.
//
// Deliberately presentational only — no tap/reveal interaction lives here.
// ListRailCard layers its own Pressable overlay on top (sized to match the
// front poster's known bounds: posterWidth × posterHeightFor(posterWidth),
// always positioned at this container's own top-left origin regardless of
// direction) for the reveal interaction; ShareCard's list box already has
// one tap-to-open handler on the whole post, so it renders this with no
// overlay at all.
export default function PosterCascade({
  items,
  direction,
  posterWidth = 84,
  maxStack = 5,
  fitToWidth,
  itemCount,
  borderWidth = 1.5,
  borderColor,
  dimBackLayers,
}: Props) {
  const { colors } = useTheme();
  const posterHeight = posterHeightFor(posterWidth);
  const isVertical = direction === "vertical";
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const stackCount = useMemo(() => {
    if (!fitToWidth) return Math.min(items.length, maxStack);
    if (measuredWidth == null) return Math.min(items.length, 1);
    const fit = Math.max(1, Math.floor((measuredWidth - posterWidth) / CASCADE_OFFSET_STEP) + 1);
    return Math.min(items.length, fit);
  }, [fitToWidth, measuredWidth, items.length, posterWidth, maxStack]);
  const stack = items.slice(0, stackCount);

  const containerSize = isVertical
    ? { width: posterWidth, height: posterHeight + (Math.max(stackCount, 1) - 1) * CASCADE_OFFSET_STEP }
    : fitToWidth
      ? { width: "100%" as const, height: posterHeight }
      : { width: posterWidth + (Math.max(stackCount, 1) - 1) * CASCADE_OFFSET_STEP, height: posterHeight };

  const handleLayout = (e: LayoutChangeEvent) => setMeasuredWidth(e.nativeEvent.layout.width);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {},
        posterSlot: { position: "absolute", top: 0, left: 0, width: posterWidth, height: posterHeight },
        poster: {
          width: "100%",
          height: "100%",
          borderRadius: CASCADE_POSTER_RADIUS,
          backgroundColor: colors.base200,
          borderWidth,
          borderColor: borderColor ?? colors.border,
        },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 11, textAlign: "center", paddingHorizontal: 4 },
        countBadge: {
          position: "absolute",
          top: 4,
          left: 4,
          minWidth: 20,
          height: 20,
          paddingHorizontal: 5,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.65)",
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
        },
        countBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.bold },
      }),
    [colors, posterWidth, posterHeight, borderWidth, borderColor]
  );

  return (
    <View style={[styles.container, containerSize]} onLayout={fitToWidth ? handleLayout : undefined}>
      {stack.map((item, i) => {
        const isFront = i === 0;
        const offset = i * CASCADE_OFFSET_STEP;
        const z = stackCount - i;
        const fadeOpacity = dimBackLayers && !isFront ? (BACK_LAYER_OPACITY[i] ?? BACK_LAYER_OPACITY[BACK_LAYER_OPACITY.length - 1]) : undefined;
        return (
          <View
            key={`${item.itemType}-${item.itemId}`}
            style={[
              styles.posterSlot,
              isVertical ? { top: offset } : { left: offset },
              { zIndex: z },
              fadeOpacity !== undefined && { opacity: fadeOpacity },
            ]}
          >
            {item.poster_path ? (
              <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Text style={styles.posterFallbackText} numberOfLines={3}>
                  {item.title}
                </Text>
              </View>
            )}
            {isFront && itemCount !== undefined && (
              <View style={styles.countBadge}>
                <Ionicons name="albums" size={10} color="#fff" />
                <Text style={styles.countBadgeText}>{itemCount}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
