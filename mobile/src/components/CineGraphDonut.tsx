import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { CineGraphRatings, CineGraphStats } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Created once at module scope — recreating it every render would remount
// the underlying SVG node and break the opacity animation driven through it.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  stats: CineGraphStats;
  genreRatings: CineGraphRatings;
  onDetailPress: (genre: string) => void;
  type: "movie" | "series";
}

// Hand-curated, fixed zone per genre — not computed from width/capacity —
// designed around the maximum real case (all 19 TMDB movie genres / all 16
// TMDB TV genres present at once): short, common genres anchor ring 1,
// longer or rarer ones go on the rectangle's top or bottom edge. Every one
// of these genres always gets a chip in this layout, whether or not the
// account has any watched items in it — genres with no data render dimmed
// (see `chips` below) rather than being omitted, so the full shape never
// changes from account to account, only which chips are lit up.
// `Documentary` deliberately lands in different zones for movies vs
// series — the two lists are independent by design, not a shared table.
const MOVIE_GENRE_ZONE: Record<string, "ring1" | "top" | "bottom"> = {
  History: "ring1",
  Western: "ring1",
  Mystery: "ring1",
  Music: "ring1",
  Family: "ring1",
  Horror: "ring1",
  Action: "ring1",
  Drama: "ring1",
  Thriller: "ring1",
  Comedy: "ring1",
  "TV Movie": "ring1",
  Romance: "top",
  Animation: "top",
  Fantasy: "top",
  Adventure: "top",
  "Science Fiction": "bottom",
  War: "bottom",
  Crime: "bottom",
  Documentary: "bottom",
};
const SERIES_GENRE_ZONE: Record<string, "ring1" | "top" | "bottom"> = {
  Comedy: "ring1",
  Crime: "ring1",
  Drama: "ring1",
  Family: "ring1",
  Kids: "ring1",
  Mystery: "ring1",
  News: "ring1",
  Reality: "ring1",
  Soap: "ring1",
  Talk: "ring1",
  Western: "ring1",
  "Sci-Fi & Fantasy": "top",
  Documentary: "top",
  Animation: "bottom",
  "Action & Adventure": "bottom",
  "War & Politics": "bottom",
};

// Fine-tuning on top of the zone tables above, hand-specified per content
// type: a top/bottom row's left-to-right order can be fixed explicitly
// (instead of inheriting whatever order the account's own counts sort
// into), and specific chips can sit a fixed amount closer to ring 1 than
// the rest of their row. Everything else in this file positions a whole
// row's chips at one shared, evenly-spaced Y — these are the deliberate,
// hand-picked exceptions.
const ROW_ORDER: Record<"movie" | "series", { top?: string[]; bottom?: string[] }> = {
  movie: {
    top: ["Adventure", "Romance", "Fantasy", "Animation"],
    bottom: ["Crime", "Science Fiction", "Documentary", "War"],
  },
  series: { top: ["Sci-Fi & Fantasy", "Documentary"], bottom: ["Animation", "Action & Adventure", "War & Politics"] },
};
const VERTICAL_NUDGE: Record<"movie" | "series", Record<string, number>> = {
  movie: { Adventure: 24, Animation: 24, War: 40, Crime: 40 },
  series: { Animation: 26, "War & Politics": 26, "Sci-Fi & Fantasy": 18, Documentary: 18 },
};
// Horizontal counterpart to `VERTICAL_NUDGE` — a signed pixel offset added
// straight onto one chip's already-computed x, without touching the
// even-gap accumulator its row siblings are positioned from, so nudging one
// chip never shifts the others.
const HORIZONTAL_NUDGE: Record<"movie" | "series", Record<string, number>> = {
  movie: {},
  series: { "Action & Adventure": 10 },
};

// Deterministic, count-independent hue spread — guarantees every genre gets
// a distinct color regardless of how many there are (a fixed color array
// would repeat past its length). `bgLuminance` (the active theme's own
// base100 background, 0=black to 1=white) nudges the pastel's lightness up
// a little on the lighter-dark themes (e.g. dim, dracula) so it doesn't
// wash out against a background that's already fairly light for a "dark"
// theme, while staying at the baseline on near-black ones (forest, black,
// luxury) where any pastel already reads with plenty of contrast. Every
// theme this app ships today is dark-family — there's no light theme yet —
// so this is a same-family contrast tweak, not a light/dark branch.
function genreColor(index: number, total: number, bgLuminance: number) {
  const hue = Math.round((360 / Math.max(total, 1)) * index);
  const lightness = Math.round(76 + Math.min(bgLuminance, 0.25) * 40);
  return `hsl(${hue}, 55%, ${lightness}%)`;
}

// Standard relative-luminance approximation from a `#rrggbb` hex string,
// 0 (black) to 1 (white). Falls back to 0 (treated the same as a true-black
// background — the existing baseline, no lightness bump) for anything that
// doesn't parse as 6 hex digits, rather than propagating a NaN into the
// HSL string `genreColor` builds — every current theme's `base100` is a
// plain hex, but this guards against an unexpected value (or a transient
// one before the theme context finishes loading) turning into a genuinely
// invalid color the SVG/style layer then rejects outright.
function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Number.isFinite(value) ? value : 0;
}

const STROKE = 24;
const MARGIN = 96; // how big the donut ring itself is inside the box
const RING_CLEARANCE = 16; // guaranteed gap between the donut ring's edge and any chip ring
const EDGE_PAD = 6; // hard boundary — no chip may render closer than this to the container edge
const CHIP_RING_PAD = 42; // ring 1's radius = donut edge + RING_CLEARANCE + this
// Top and bottom edges sit the same fixed distance beyond ring 1's true max
// radius, on purpose — a symmetric look was explicitly requested (top and
// bottom equally far from ring 1), so this is one shared constant rather
// than two that could drift apart again.
const RECT_GAP = 52;
const RECT_V_PAD = 20; // extra vertical breathing room reserved beyond the rectangle's nominal distance, per edge
const PAGE_DOWN_SHIFT = 10; // moves the entire graphic (box and all) further down the page, per explicit request
const CHIP_FALLBACK_SIZE = { width: 70, height: 26 };
const CENTER_WRAP_WIDTH = 126; // wide enough for the genre-detail content, narrow enough to stay inside the ring
const CENTER_WRAP_HEIGHT = 68; // shorter now that the detail panel has no genre-name title, just stats + button
const ROTATE_MS = 480;
const REVEAL_MS = 260;
const EXPLODE_OFFSET = 10; // how far the selected slice pops out from the ring, once aligned

function normalizeAngle(a: number) {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

// The largest radius, along a given angle, at which a *centered* box of this
// size still fits entirely inside a `boxWidth`x`boxHeight` container
// (EDGE_PAD in from each edge). Width and height are capped independently
// since the container itself is no longer necessarily square.
function maxRadiusForAngle(
  angle: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  boxWidth: number,
  boxHeight: number
) {
  const EPS = 1e-4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  let rH = Infinity;
  if (cos > EPS) rH = (boxWidth - EDGE_PAD - width / 2 - cx) / cos;
  else if (cos < -EPS) rH = (EDGE_PAD + width / 2 - cx) / cos;

  let rV = Infinity;
  if (sin > EPS) rV = (boxHeight - EDGE_PAD - height / 2 - cy) / sin;
  else if (sin < -EPS) rV = (EDGE_PAD + height / 2 - cy) / sin;

  return Math.max(0, Math.min(rH, rV));
}

interface SliceItem {
  genre: string;
  count: number;
  pct: number;
  rating: number | null;
  angle: number; // this genre's slice midpoint angle, on the *unrotated* ring
  color: string;
}

interface ChipItem {
  genre: string;
  angle: number;
  radius: number;
  px: number; // the chip's true center — also what the connecting line targets
  py: number;
  left: number;
  top: number;
  width: number;
  height: number;
  hasData: boolean; // false when this account has no watched items in this genre — renders dimmed, no real slice to align to
}

export default function CineGraphDonut({ stats, genreRatings, onDetailPress, type }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const bgLuminance = useMemo(() => hexLuminance(colors.base100), [colors.base100]);

  // The box is no longer square: width is still capped to the screen (same
  // as before, and what drives the donut's own size via MARGIN), but height
  // is computed separately so the outer rectangle has genuine room to sit
  // far from ring 1 without EDGE_PAD clamping quietly pulling it back in —
  // that clamping was real and correct, but a square container was simply
  // too short for how far out the rectangle is meant to be.
  const boxWidth = Math.min(screenWidth - 32, 420);
  const centerX = boxWidth / 2;
  const outerRadius = centerX - MARGIN;
  const ringRadius = outerRadius - STROKE / 2;

  const ring1Radius = outerRadius + RING_CLEARANCE + CHIP_RING_PAD;
  const spaceAbove = ring1Radius + RECT_GAP + RECT_V_PAD;
  const spaceBelow = ring1Radius + RECT_GAP + RECT_V_PAD;
  const boxHeight = spaceAbove + spaceBelow;
  const centerY = spaceAbove; // donut center sits this far from the box's own top edge

  const areaMinHeight = Math.max(boxHeight + 40, screenHeight * 0.5);

  const [selected, setSelected] = useState<string | null>(null);

  const [chipSizes, setChipSizes] = useState<Record<string, { width: number; height: number }>>({});
  // Measured once per genre, then frozen — never overwritten again after
  // that first successful layout. This is what the previous "round to whole
  // px" version of this function was trying to achieve, and mostly did, but
  // not always: RN's text layout can report a ±1px oscillating width for
  // the exact same string across otherwise-identical renders (sub-pixel
  // font-hinting noise), which rounding alone doesn't fully absorb when a
  // genre's true width sits right at a rounding boundary. The real trigger
  // is `forceTick` above — it re-renders this entire component on every
  // frame of ANY genre's rotation animation (selecting/deselecting one
  // genre spends ~30 frames re-rendering *all* chips), and re-rendering was
  // enough on some devices to re-fire onLayout even without a real size
  // change. Committing every new value fed that noise straight back into
  // `chips`' position math (a chip's radius depends on its own width), so a
  // chip nowhere near the selection could start visibly nudging back and
  // forth on its own — reported as "Comedy/Western/News jitter while just
  // sitting there." Freezing after the first commit makes chipSizes
  // write-once, which makes that feedback loop structurally impossible
  // instead of just less likely — later onLayout events for an
  // already-measured genre are simply ignored. Safe to trust permanently:
  // the map itself resets on remount (switching the movie/series subtab
  // unmounts this component entirely), so a genre is never measured against
  // a stale size left over from a previous dataset.
  const handleChipLayout = (genre: string, width: number, height: number) => {
    setChipSizes((prev) => {
      if (prev[genre]) return prev;
      return { ...prev, [genre]: { width: Math.round(width), height: Math.round(height) } };
    });
  };

  const slices = useMemo(() => {
    const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return { total: 0, list: [] as SliceItem[], boundaries: [] as number[] };
    let acc = 0;
    // One boundary angle per slice, at its *start* — since the slices tile
    // a full circle with no gaps, a slice's start is the previous slice's
    // end, so N slices need exactly N boundary lines, not 2N.
    const boundaries: number[] = [];
    const list: SliceItem[] = entries.map(([genre, count], i) => {
      boundaries.push((acc / total) * 2 * Math.PI - Math.PI / 2);
      acc += count;
      const midFrac = acc / total - count / total / 2;
      const angle = midFrac * 2 * Math.PI - Math.PI / 2;
      return {
        genre,
        count,
        pct: (count / total) * 100,
        rating: genreRatings[genre] ?? null,
        angle,
        color: genreColor(i, entries.length, bgLuminance),
      };
    });
    return { total, list, boundaries };
  }, [stats, genreRatings, bgLuminance]);

  // Every genre in the fixed zone table (`MOVIE_GENRE_ZONE`/
  // `SERIES_GENRE_ZONE` above) gets a chip, whether or not this account has
  // any watched items in it — ring 1, the rectangle's top edge, or its
  // bottom edge, chosen once around the maximum real case (every TMDB genre
  // present) and never recomputed from width/capacity. A genre with no data
  // renders dimmed (see below) rather than being omitted, so the full
  // layout is always the same shape regardless of account. Every chip's
  // position here is final — once placed, nothing (selecting a genre,
  // opening its detail) ever moves a chip again, by design.
  const chips = useMemo(() => {
    const zoneOf = type === "movie" ? MOVIE_GENRE_ZONE : SERIES_GENRE_ZONE;
    const allGenreKeys = Object.keys(zoneOf);
    // Present genres keep exactly the order they had before this pass
    // (count-descending, `slices.list`'s own order) — ring 1 has no
    // explicit `ROW_ORDER` override, so this ordering is what actually
    // determines each present chip's angular slot; changing it (as an
    // earlier version of this code accidentally did, by just iterating the
    // zone table's own declaration order for everyone) shifted every
    // already-tuned position even when the *set* of present genres didn't
    // change. Absent genres are appended after, in the zone table's own
    // order — stable, but otherwise arbitrary, since they never had a
    // "before" position to preserve.
    const presentRank = new Map(slices.list.map((s, i) => [s.genre, i]));
    const orderedGenres = [...allGenreKeys].sort((a, b) => {
      const ra = presentRank.get(a) ?? Infinity;
      const rb = presentRank.get(b) ?? Infinity;
      return ra !== rb ? ra - rb : allGenreKeys.indexOf(a) - allGenreKeys.indexOf(b);
    });
    const presentGenres = new Set(slices.list.map((s) => s.genre));
    const withMeta = orderedGenres.map((genre) => {
      const measured = chipSizes[genre];
      const width = measured?.width ?? Math.max(CHIP_FALLBACK_SIZE.width, 24 + genre.length * 6.2);
      const height = measured?.height ?? CHIP_FALLBACK_SIZE.height;
      return { genre, width, height, zone: zoneOf[genre], hasData: presentGenres.has(genre) };
    });

    const result = new Map<string, ChipItem>();
    const setChip = (genre: string, px: number, py: number, width: number, height: number, hasData: boolean) => {
      result.set(genre, {
        genre,
        angle: Math.atan2(py - centerY, px - centerX),
        radius: Math.hypot(px - centerX, py - centerY),
        px,
        py,
        left: px - width / 2,
        top: py - height / 2,
        width,
        height,
        hasData,
      });
    };

    // Ring 1 — every zone-"ring1" genre, present or not, spread evenly
    // around the full circle. Deliberately independent per chip — each
    // one's radius depends only on its *own* width/height, never on any
    // other chip's — so no chip's position can ever be affected by another
    // chip's measured size arriving (e.g. from a still-settling `chipSizes`
    // update) in a different render than its own. An earlier version of
    // this loop pushed a chip's radius out when it detected an overlap with
    // an already-placed neighbor; that made one chip's final position
    // depend on every earlier chip's in the same pass, which is exactly the
    // kind of cross-chip dependency that's caused real jitter/oscillation
    // bugs earlier in this file (see the `handleChipLayout` rounding fix
    // above) — removed rather than reworked, since it turned out to be
    // unnecessary for the fixed, short-name ring-1 curation in practice.
    const ring1Group = withMeta.filter((c) => c.zone === "ring1");
    // Tracks the *actual* farthest any ring-1 chip ends up, not just the
    // nominal ring1Radius — a wide genre's ring-clearance floor
    // (`outerRadius + RING_CLEARANCE + width/2`) can push its real radius
    // past ring1Radius, and the rectangle below must clear that real
    // maximum, not the nominal one, or it could end up overlapping a wide
    // ring-1 chip despite the gap looking correct on paper.
    let ring1MaxRadius = ring1Radius;
    ring1Group.forEach((c, i) => {
      const angle = (i / ring1Group.length) * 2 * Math.PI - Math.PI / 2;
      const edgeCap = maxRadiusForAngle(angle, c.width, c.height, centerX, centerY, boxWidth, boxHeight);
      const floor = outerRadius + RING_CLEARANCE + Math.max(c.width, c.height) / 2;
      const radius = Math.max(floor, Math.min(ring1Radius, edgeCap));
      ring1MaxRadius = Math.max(ring1MaxRadius, radius);
      setChip(c.genre, centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle), c.width, c.height, c.hasData);
    });

    // Top/bottom rectangle edges — every zone-"top"/"bottom" genre present,
    // spread evenly along a straight line (see the edge-gap math below).
    // Both edges start the same fixed distance beyond `ring1MaxRadius` (the
    // *real* farthest ring-1 chip, not the nominal radius) — `RECT_GAP` —
    // for a symmetric top/bottom look.
    const placeRow = (group: typeof withMeta, dir: -1 | 1) => {
      if (group.length === 0) return;
      const halfHeight = ring1MaxRadius + RECT_GAP;
      const maxH = Math.max(...group.map((g) => g.height));
      const nominalY = dir === -1 ? centerY - halfHeight : centerY + halfHeight;
      const baseY =
        dir === -1
          ? Math.max(EDGE_PAD + maxH / 2, Math.min(nominalY, centerY - outerRadius - RING_CLEARANCE - maxH / 2))
          : Math.min(boxHeight - EDGE_PAD - maxH / 2, Math.max(nominalY, centerY + outerRadius + RING_CLEARANCE + maxH / 2));
      // A hand-picked subset of this content type's chips sit a fixed
      // amount closer to ring 1 than the rest of their own row — the amount
      // is per-genre, added (top row moves down toward center) or
      // subtracted (bottom row moves up toward center) depending on which
      // edge this is.
      const yFor = (genre: string) => {
        const nudge = VERTICAL_NUDGE[type][genre];
        return nudge === undefined ? baseY : baseY + (dir === -1 ? nudge : -nudge);
      };
      // Clamped to at most half the row's own gap either way — a plain
      // unclamped nudge could eat the *entire* gap on one side (or more)
      // and push into a neighbor's box, since it deliberately doesn't shift
      // the neighbor to compensate. Capping at half the gap guarantees at
      // least half a gap's worth of breathing room always remains on both
      // sides, however large the requested nudge is.
      const xFor = (idealX: number, genre: string, maxNudge = Infinity) => {
        const raw = HORIZONTAL_NUDGE[type][genre] ?? 0;
        return idealX + Math.max(-maxNudge, Math.min(maxNudge, raw));
      };

      // Evenly-spaced by *edge gap*, not by center position — with items of
      // different widths (a real bug here: "Science Fiction" next to
      // "War"), spacing centers evenly still leaves the actual gap between
      // two wide neighbors' edges smaller than the gap between two narrow
      // ones, occasionally small enough for them to touch. Distributing the
      // row's genuinely leftover width (`boxWidth - 2*EDGE_PAD - Σwidths`)
      // as one equal gap between every adjacent pair guarantees the visual
      // gap is identical everywhere, and — since it's derived from the real
      // total, not an approximation — can never go negative for a row this
      // small (at most 4 chips).
      const n = group.length;
      if (n === 1) {
        setChip(
          group[0].genre,
          xFor(centerX, group[0].genre),
          yFor(group[0].genre),
          group[0].width,
          group[0].height,
          group[0].hasData
        );
      } else {
        const sumW = group.reduce((sum, g) => sum + g.width, 0);
        const gap = Math.max(0, (boxWidth - 2 * EDGE_PAD - sumW) / (n - 1));
        let left = EDGE_PAD;
        group.forEach((c) => {
          setChip(c.genre, xFor(left + c.width / 2, c.genre, gap / 2), yFor(c.genre), c.width, c.height, c.hasData);
          left += c.width + gap;
        });
      }
    };

    // Explicit left-to-right order where one's specified for this content
    // type, hand-picked rather than left to whatever order the account's
    // own counts sort into — robust to a subset being present since it
    // only sorts whichever of these are actually there.
    const orderRow = (group: typeof withMeta, order: string[] | undefined) =>
      order ? [...group].sort((a, b) => order.indexOf(a.genre) - order.indexOf(b.genre)) : group;

    const topGroup = orderRow(
      withMeta.filter((c) => c.zone === "top"),
      ROW_ORDER[type].top
    );
    const bottomGroup = orderRow(
      withMeta.filter((c) => c.zone === "bottom"),
      ROW_ORDER[type].bottom
    );
    placeRow(topGroup, -1);
    placeRow(bottomGroup, 1);

    return result;
  }, [slices, chipSizes, type, outerRadius, ring1Radius, centerX, centerY, boxWidth, boxHeight]);

  // Rotation is JS-thread-driven (a listener forcing a re-render each
  // frame) rather than a native-driver Animated transform, since the
  // connecting line needs the live in-between angle every frame too, not
  // just the ring — same idiom this component has used for every other
  // animated value so far.
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const rotationRef = useRef(0);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = rotationAnim.addListener(({ value }) => {
      rotationRef.current = value;
      forceTick((n) => n + 1);
    });
    return () => rotationAnim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drives, once rotation has settled: the connecting line's opacity, and
  // the crossfade in the donut's own center between the total-count summary
  // and the selected genre's detail (count/%/rating/Detail button) — no
  // chip ever moves or resizes anymore, this is the only thing that reveals.
  const revealAnim = useRef(new Animated.Value(0)).current;

  const selectGenre = (genre: string) => {
    const nextSelected = selected === genre ? null : genre;
    const targetSlice = nextSelected ? slices.list.find((s) => s.genre === nextSelected) : null;
    const targetChip = nextSelected ? chips.get(nextSelected) : null;
    // Rotating the ring by (chip.angle - slice.angle) makes the slice's own
    // rotated angle land exactly on the chip's angle — so after the
    // animation, the line drawn from the ring straight out along the
    // slice's axis lands exactly on the chip, never anywhere else.
    const target = targetSlice && targetChip ? targetChip.angle - targetSlice.angle : 0;
    const current = rotationRef.current;
    const finalTarget = current + normalizeAngle(target - current);
    setSelected(nextSelected);
    revealAnim.stopAnimation();
    revealAnim.setValue(0);
    Animated.timing(rotationAnim, { toValue: finalTarget, duration: ROTATE_MS, useNativeDriver: false }).start(({ finished }) => {
      if (finished && nextSelected) {
        Animated.timing(revealAnim, { toValue: 1, duration: REVEAL_MS, useNativeDriver: false }).start();
      }
    });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginTop: 24, alignSelf: "stretch", justifyContent: "center", alignItems: "center" },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center" },
        box: { alignSelf: "center", marginTop: PAGE_DOWN_SHIFT },
        centerWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
        centerOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        centerLabel: { textAlign: "center", color: colors.baseContent, fontFamily: fonts.bold, fontSize: 16 },
        centerLabelSub: { fontSize: 10, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5 },
        centerDetailRow: { fontSize: 11, fontFamily: fonts.medium, color: colors.baseContent, marginBottom: 3, textAlign: "center" },
        chip: { position: "absolute", borderWidth: 1.5, borderRadius: 14, backgroundColor: colors.base200 },
        chipPress: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 5 },
        chipText: { fontSize: 11.5, fontFamily: fonts.medium },
        detailButton: {
          marginTop: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 10,
          backgroundColor: colors.primary,
        },
        detailButtonText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primaryContent },
      }),
    [colors]
  );

  if (slices.list.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.empty}>{t("No data yet.")}</Text>
      </View>
    );
  }

  const circumference = 2 * Math.PI * ringRadius;
  const rotationDeg = (rotationRef.current * 180) / Math.PI;
  let sliceOffset = 0;

  const selectedSliceData = selected ? slices.list.find((s) => s.genre === selected) : null;

  return (
    <View style={[styles.section, { minHeight: areaMinHeight }]}>
      <View style={[styles.box, { width: boxWidth, height: boxHeight }]}>
        <Svg width={boxWidth} height={boxHeight}>
          <G rotation={rotationDeg} origin={`${centerX}, ${centerY}`}>
            {slices.list.map((s) => {
              const sliceLen = (s.count / slices.total) * circumference;
              const dashOffset = -sliceOffset + circumference * 0.25;
              sliceOffset += sliceLen;
              const isSelected = s.genre === selected;
              // Once a selected slice has rotated into alignment with its
              // button, it pops out from the ring a little — the classic
              // "exploded" pie/donut slice look — instead of any separate
              // marker. Since every slice `Circle` is really a full circle
              // shown only through its dash-visible arc, shifting *that
              // circle's own center* along the slice's own bisector angle
              // (still inside the rotating <G>, so the offset direction
              // rotates correctly with everything else) is what makes just
              // that arc appear detached, without touching its radius or
              // any other slice. Every slice renders as `AnimatedCircle`,
              // even non-selected ones (with plain numeric cx/cy, which
              // Animated components accept fine) — switching element type
              // between plain `Circle` and `AnimatedCircle` depending on
              // selection would force React to unmount/remount that node
              // every time selection changes, a real source of visual
              // hiccups on the ring.
              const cx = isSelected
                ? revealAnim.interpolate({ inputRange: [0, 1], outputRange: [centerX, centerX + EXPLODE_OFFSET * Math.cos(s.angle)] })
                : centerX;
              const cy = isSelected
                ? revealAnim.interpolate({ inputRange: [0, 1], outputRange: [centerY, centerY + EXPLODE_OFFSET * Math.sin(s.angle)] })
                : centerY;
              return (
                <AnimatedCircle
                  key={s.genre}
                  cx={cx}
                  cy={cy}
                  r={ringRadius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${sliceLen} ${circumference - sliceLen}`}
                  strokeDashoffset={dashOffset}
                  onPress={() => selectGenre(s.genre)}
                />
              );
            })}
            {slices.list.length > 1 &&
              slices.boundaries.map((a, i) => {
                const innerR = ringRadius - STROKE / 2;
                const outerR = ringRadius + STROKE / 2;
                return (
                  <Line
                    key={i}
                    x1={centerX + innerR * Math.cos(a)}
                    y1={centerY + innerR * Math.sin(a)}
                    x2={centerX + outerR * Math.cos(a)}
                    y2={centerY + outerR * Math.sin(a)}
                    stroke={colors.base100}
                    strokeWidth={2}
                  />
                );
              })}
          </G>
        </Svg>

        <View
          style={[
            styles.centerWrap,
            {
              left: centerX - CENTER_WRAP_WIDTH / 2,
              top: centerY - CENTER_WRAP_HEIGHT / 2,
              width: CENTER_WRAP_WIDTH,
              height: CENTER_WRAP_HEIGHT,
            },
          ]}
        >
          {selected ? (
            <>
              <Animated.View
                style={[styles.centerOverlay, { opacity: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
                pointerEvents="none"
              >
                <Text style={styles.centerLabel}>{slices.total}</Text>
                <Text style={styles.centerLabelSub}>{t("items")}</Text>
              </Animated.View>
              <Animated.View
                style={[styles.centerOverlay, { opacity: revealAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]}
              >
                {selectedSliceData ? (
                  <>
                    <Text style={styles.centerDetailRow}>
                      {selectedSliceData.count} {t("items")} · {Math.round(selectedSliceData.pct)}%
                    </Text>
                    <Text style={styles.centerDetailRow}>
                      {selectedSliceData.rating != null ? `★ ${(selectedSliceData.rating / 2).toFixed(1)}` : t("Unrated")}
                    </Text>
                    <Pressable onPress={() => onDetailPress(selectedSliceData.genre)} style={styles.detailButton}>
                      <Text style={styles.detailButtonText}>{t("Detail")}</Text>
                    </Pressable>
                  </>
                ) : (
                  // No watched items in this genre at all — just the count,
                  // no percentage/rating (neither means anything at 0) and
                  // no Detail button (there's nothing to view).
                  <Text style={styles.centerDetailRow}>
                    0 {t("items")}
                  </Text>
                )}
              </Animated.View>
            </>
          ) : (
            <View pointerEvents="none">
              <Text style={styles.centerLabel}>{slices.total}</Text>
              <Text style={styles.centerLabelSub}>{t("items")}</Text>
            </View>
          )}
        </View>

        {Array.from(chips.values()).map((chip) => {
          const isSelected = chip.genre === selected;
          // Chips for genres this account has never watched anything in
          // still render — same fixed slot, same size — but dimmed: gray
          // instead of a slice color (there's no slice, and so no color
          // assigned to fade from), since it isn't part of the pie at all.
          const sliceColor = slices.list.find((s) => s.genre === chip.genre)?.color;
          const color = sliceColor ?? colors.placeholder;
          return (
            <View
              key={chip.genre}
              style={[
                styles.chip,
                { left: chip.left, top: chip.top },
                {
                  borderColor: color,
                  borderWidth: isSelected ? 2 : 1.5,
                  backgroundColor: isSelected ? color : colors.base200,
                  opacity: chip.hasData ? 1 : 0.5,
                },
              ]}
            >
              <Pressable
                onPress={() => selectGenre(chip.genre)}
                onLayout={(e) => handleChipLayout(chip.genre, e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
                style={styles.chipPress}
              >
                {/* Pastel fills are light, so white text (fine against the
                    old vivid colors) would barely read — a fixed dark tone
                    stays legible against any hue at this lightness. */}
                <Text style={[styles.chipText, { color: isSelected ? "#2b2b2b" : color }]} numberOfLines={1}>
                  {chip.genre}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
