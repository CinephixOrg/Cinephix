import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Pressable from "../common/TapSafePressable";
import Svg, { Circle, Line } from "react-native-svg";
import UserAvatar from "../UserAvatar";
import type { CineGraphStats } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// A deliberate copy of CineGraphDonut.tsx (Profile's genre donut), not a
// shared/parameterized component — the positioning math (zone tables, chip
// layout) is reused verbatim below, but the interaction model diverges
// enough (multi-select, no rotation, empty center) that most of the
// original's *interaction* code wouldn't be shareable anyway, and copying
// avoids any risk to Profile's already-hard-won, exactly-as-is behavior.
//
// Real differences from CineGraphDonut, all explicit product decisions:
// - Multi-select: any number of genres can be active at once (this is a
//   filter picker, not a single "view detail" selector) — controlled via
//   `selectedGenres`/`onToggleGenre` props, not owned internally.
// - No ring rotation and no explode movement at all — slices never move.
//   Selection is shown as a pure color state instead: unselected slices
//   render dim gray, a selected slice renders in its own assigned color.
// - Center is empty — no total-count summary, no genre-detail crossfade, no
//   Detail button. This ring only picks filter genres, it doesn't show
//   stats about them.
// - Doesn't early-return on "no data yet": a genre with zero watched items
//   still needs to be selectable as a match filter, so the fixed-zone chip
//   layout always renders (dimmed for absent genres) even when there are no
//   slices to draw at all.
// - Center shows the viewer's own avatar (disabled UserAvatar, non-
//   interactive — pointerEvents:"none" on its wrapper) instead of being
//   truly empty — a later correction; it's still not a stats/detail panel.

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

// Exported so MatchFilterStrip.tsx can compute "are all genres for this
// content type currently selected" (for the Apply All Genres button's own
// derived checked-state) against the exact same set this ring renders chips
// for, rather than a separately-maintained genre list that could drift.
export const MATCH_GENRE_KEYS: Record<"movie" | "series", string[]> = {
  movie: Object.keys(MOVIE_GENRE_ZONE),
  series: Object.keys(SERIES_GENRE_ZONE),
};

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
const HORIZONTAL_NUDGE: Record<"movie" | "series", Record<string, number>> = {
  movie: {},
  series: { "Action & Adventure": 10 },
};

// Exported so other match-feature components needing the same deterministic
// per-item HSL coloring (e.g. MatchAnalysisPanel's shared-genre chips) reuse
// this instead of inventing a second palette.
export function genreColor(index: number, total: number, bgLuminance: number) {
  const hue = Math.round((360 / Math.max(total, 1)) * index);
  const lightness = Math.round(76 + Math.min(bgLuminance, 0.25) * 40);
  return `hsl(${hue}, 55%, ${lightness}%)`;
}

export function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Number.isFinite(value) ? value : 0;
}

const STROKE = 24;
const MARGIN = 96;
const RING_CLEARANCE = 16;
const EDGE_PAD = 6;
const CHIP_RING_PAD = 42;
const RECT_GAP = 52;
const RECT_V_PAD = 20;
const PAGE_DOWN_SHIFT = 10;
const CHIP_FALLBACK_SIZE = { width: 70, height: 26 };
// Match-button loading state: chips collapse straight into the center over
// this long (slow/aesthetic, not a snappy UI transition) — unchanged, per
// direct ask to leave the collapse alone.
const COLLAPSE_MS = 1300;
// The ring does exactly ONE 360° turn per press — not several accelerating/
// cruising/decelerating laps. Three earlier rounds all assumed a *looping*
// spin (chasing lap duration, cruise speed, ramp timing back and forth)
// before the user said outright that was never the ask: "halkanın illa
// birkaç tur atmasına gerek yok, hatta 1 tur atsın... VE YAVAŞ BİR HIZDA
// DÖNSÜN." One slow, fully eased single rotation, matching
// match/index.tsx's own MATCH_LOADING_MS (the guaranteed-minimum loading
// window) — Easing.inOut(cubic) alone gives a gentle start, a gentle
// finish, and everything in between smoothly connected, with no separate
// ramp/cruise/decay phases (and no Animated.loop/Animated.decay) needed at
// all now that there's no repeating motion to loop or coast out of.
const ROTATE_MS = 2400;
// How long to keep chips collapsed/hidden — and, now that the ring is a
// single non-repeating rotation with nothing left to interrupt mid-flight,
// the ring itself too — after loading ends before snapping back to rest.
const RESET_DELAY_MS = 1000;

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
  angle: number;
  color: string;
}

interface ChipItem {
  genre: string;
  left: number;
  top: number;
  width: number;
  height: number;
  hasData: boolean;
}

interface Props {
  stats: CineGraphStats;
  type: "movie" | "series";
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
  userId: string;
  username: string;
  profilePicUrl?: string;
  // True while a match search is in flight — genre chips collapse straight
  // into the center avatar and fade out, and the ring spins in place, as the
  // page's own loading indicator. Chips/slices stop responding to taps.
  loading?: boolean;
  // Fires once, exactly when the ring's own single rotation animation
  // actually finishes (not on an interrupted restart) — match/index.tsx
  // uses this as the real completion signal for its own page-transition
  // timing instead of a second, independently-guessed duration that has to
  // be kept in sync by hand. See match/index.tsx's own comment for the bug
  // this fixes: two separate timers that happened to both read 2400 today
  // could silently drift apart the next time either one changes.
  onSpinComplete?: () => void;
}

export default function CineMatchGenreRing({
  stats,
  type,
  selectedGenres,
  onToggleGenre,
  userId,
  username,
  profilePicUrl,
  loading,
  onSpinComplete,
}: Props) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const bgLuminance = useMemo(() => hexLuminance(colors.base100), [colors.base100]);

  const boxWidth = Math.min(screenWidth - 32, 420);
  const centerX = boxWidth / 2;
  const outerRadius = centerX - MARGIN;
  const ringRadius = outerRadius - STROKE / 2;
  // Scales with the actual inner space this ring's fixed MARGIN leaves
  // (varies with screen width), clamped to a sensible range rather than one
  // fixed size that could overflow on a narrow device or look lost on a
  // wide one.
  const avatarSize = Math.min(100, Math.max(50, (outerRadius - STROKE) * 1.6));
  // Fills the empty gap between the ring's inner edge and the (smaller)
  // avatar so a collapsing chip disappears cleanly instead of flashing
  // through visible background as it passes through that gap. A couple of
  // extra px of overlap into the ring's own inner edge avoids an antialiasing
  // seam between the two.
  const centerFillRadius = outerRadius - STROKE + 2;

  const ring1Radius = outerRadius + RING_CLEARANCE + CHIP_RING_PAD;
  const spaceAbove = ring1Radius + RECT_GAP + RECT_V_PAD;
  const spaceBelow = ring1Radius + RECT_GAP + RECT_V_PAD;
  const boxHeight = spaceAbove + spaceBelow;
  const centerY = spaceAbove;

  // Measured once per genre, then frozen — never overwritten again after
  // that first successful layout. A copy of the exact fix already landed in
  // CineGraphDonut.tsx (Profile's own version of this ring), for the exact
  // same bug: this component's `rotateAnim`/`collapseAnim` (and any parent
  // re-render — a filter change, a prop update) fire onLayout again on
  // every already-placed chip, and RN's text layout can report a ±1px
  // oscillating width for the same string across otherwise-identical
  // renders (sub-pixel font-hinting noise). The previous version here
  // committed every new value it saw (guarded only by "did the rounded
  // value actually change"), which was enough to let that noise feed back
  // into `chips`' position math (a chip's radius depends on its own
  // width) — a chip nowhere near the current interaction could start
  // visibly nudging on its own, reported as buttons jittering "under
  // certain conditions." Freezing after the first commit makes chipSizes
  // write-once, so later onLayout events for an already-measured genre are
  // simply ignored — the feedback loop becomes structurally impossible
  // instead of just less likely. Safe to trust permanently: the map itself
  // resets on remount (switching the movie/series subtab unmounts this
  // component), so a genre is never measured against a stale size left
  // over from a previous dataset.
  const [chipSizes, setChipSizes] = useState<Record<string, { width: number; height: number }>>({});
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
    const boundaries: number[] = [];
    const list: SliceItem[] = entries.map(([genre, count], i) => {
      boundaries.push((acc / total) * 2 * Math.PI - Math.PI / 2);
      acc += count;
      const midFrac = acc / total - count / total / 2;
      const angle = midFrac * 2 * Math.PI - Math.PI / 2;
      return { genre, count, angle, color: genreColor(i, entries.length, bgLuminance) };
    });
    return { total, list, boundaries };
  }, [stats, bgLuminance]);

  const chips = useMemo(() => {
    const zoneOf = type === "movie" ? MOVIE_GENRE_ZONE : SERIES_GENRE_ZONE;
    const allGenreKeys = Object.keys(zoneOf);
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
      result.set(genre, { genre, left: px - width / 2, top: py - height / 2, width, height, hasData });
    };

    const ring1Group = withMeta.filter((c) => c.zone === "ring1");
    let ring1MaxRadius = ring1Radius;
    ring1Group.forEach((c, i) => {
      const angle = (i / ring1Group.length) * 2 * Math.PI - Math.PI / 2;
      const edgeCap = maxRadiusForAngle(angle, c.width, c.height, centerX, centerY, boxWidth, boxHeight);
      const floor = outerRadius + RING_CLEARANCE + Math.max(c.width, c.height) / 2;
      const radius = Math.max(floor, Math.min(ring1Radius, edgeCap));
      ring1MaxRadius = Math.max(ring1MaxRadius, radius);
      setChip(c.genre, centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle), c.width, c.height, c.hasData);
    });

    const placeRow = (group: typeof withMeta, dir: -1 | 1) => {
      if (group.length === 0) return;
      const halfHeight = ring1MaxRadius + RECT_GAP;
      const maxH = Math.max(...group.map((g) => g.height));
      const nominalY = dir === -1 ? centerY - halfHeight : centerY + halfHeight;
      const baseY =
        dir === -1
          ? Math.max(EDGE_PAD + maxH / 2, Math.min(nominalY, centerY - outerRadius - RING_CLEARANCE - maxH / 2))
          : Math.min(boxHeight - EDGE_PAD - maxH / 2, Math.max(nominalY, centerY + outerRadius + RING_CLEARANCE + maxH / 2));
      const yFor = (genre: string) => {
        const nudge = VERTICAL_NUDGE[type][genre];
        return nudge === undefined ? baseY : baseY + (dir === -1 ? nudge : -nudge);
      };
      const xFor = (idealX: number, genre: string, maxNudge = Infinity) => {
        const raw = HORIZONTAL_NUDGE[type][genre] ?? 0;
        return idealX + Math.max(-maxNudge, Math.min(maxNudge, raw));
      };

      const n = group.length;
      if (n === 1) {
        setChip(group[0].genre, xFor(centerX, group[0].genre), yFor(group[0].genre), group[0].width, group[0].height, group[0].hasData);
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

    const orderRow = (group: typeof withMeta, order: string[] | undefined) =>
      order ? [...group].sort((a, b) => order.indexOf(a.genre) - order.indexOf(b.genre)) : group;

    placeRow(orderRow(withMeta.filter((c) => c.zone === "top"), ROW_ORDER[type].top), -1);
    placeRow(orderRow(withMeta.filter((c) => c.zone === "bottom"), ROW_ORDER[type].bottom), 1);

    return result;
  }, [slices, chipSizes, type, outerRadius, ring1Radius, centerX, centerY, boxWidth, boxHeight]);

  // collapseAnim: 0 = chips at rest, 1 = fully collapsed into the center and
  // invisible. rotateAnim: one single eased 0->1 (360°) turn per press, not
  // a repeating spin — see ROTATE_MS's own comment for why the earlier
  // loop/decay machinery is gone entirely.
  const collapseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  // Stays true a little past `loading` itself, through the delayed reset
  // below — closes a real edge case where an invisible, still-collapsed
  // chip would otherwise start accepting taps again the instant `loading`
  // flips false, before it's visually back in its resting spot.
  const [suppressInteraction, setSuppressInteraction] = useState(false);

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    if (loading) {
      setSuppressInteraction(true);
      Animated.timing(collapseAnim, {
        toValue: 1,
        duration: COLLAPSE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();

      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      // One slow, fully eased turn — Easing.inOut(quad) (not cubic: cubic's
      // own tail flattens out so much near the very end that the ring
      // visually reads as "already stopped" a real fraction of a second
      // before the animation's own timer actually finishes, which is what
      // showed up as "an awkward wait after the animation" once the page
      // transition below started waiting for this exact completion event —
      // quad's gentler tail keeps the ring visibly moving much closer to
      // the real end) reads as gently starting, gently finishing, and
      // smoothly connected in between, with no separate ramp/cruise/decay
      // phases to compose or interrupt correctly. Nothing to stop
      // mid-flight and hand off from either: if `loading` flips false
      // before this finishes, it's simply left running and reset alongside
      // collapseAnim below — a single non-repeating rotation that's
      // already most of the way through its one turn doesn't need a
      // special interrupt path the way an indefinite loop did.
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: ROTATE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onSpinComplete?.();
      });
    } else {
      resetTimer = setTimeout(() => {
        collapseAnim.setValue(0);
        rotateAnim.setValue(0);
        setSuppressInteraction(false);
      }, RESET_DELAY_MS);
    }

    return () => {
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [loading]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { alignSelf: "stretch", justifyContent: "center", alignItems: "center" },
        box: { alignSelf: "center", marginTop: PAGE_DOWN_SHIFT },
        // Stacking, back to front: chip (0) < ring (1) < center gap-fill (2)
        // < avatar (3) — a collapsing chip passes under the ring's stroke,
        // then disappears behind the fill before it ever reaches the avatar.
        centerWrap: { position: "absolute", zIndex: 3 },
        centerFill: { position: "absolute", zIndex: 2 },
        chip: { position: "absolute", borderWidth: 1.5, borderRadius: 14, backgroundColor: colors.base200, zIndex: 0 },
        chipPress: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 5 },
        chipText: { fontSize: 11.5, fontFamily: fonts.medium },
        ringWrap: { zIndex: 1 },
      }),
    [colors]
  );

  const circumference = 2 * Math.PI * ringRadius;
  let sliceOffset = 0;
  const selectedSet = new Set(selectedGenres);

  return (
    <View style={styles.section}>
      <View style={[styles.box, { width: boxWidth, height: boxHeight }]}>
        <Animated.View
          // No slice (or anything else in this Svg) has its own onPress
          // anymore — selection only happens via the chip buttons below —
          // so this can be fully pass-through rather than "box-none" (which
          // still lets touchable descendants claim a touch; there are none
          // left to claim one, and "none" is the more explicit, robust
          // setting for that).
          pointerEvents="none"
          style={[
            styles.ringWrap,
            {
              transform: [
                { rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
              ],
            },
          ]}
        >
          <Svg width={boxWidth} height={boxHeight}>
            {slices.total > 0 &&
              slices.list.map((s) => {
                const sliceLen = (s.count / slices.total) * circumference;
                const dashOffset = -sliceOffset + circumference * 0.25;
                sliceOffset += sliceLen;
                return (
                  <Circle
                    key={s.genre}
                    cx={centerX}
                    cy={centerY}
                    r={ringRadius}
                    fill="none"
                    stroke={selectedSet.has(s.genre) ? s.color : colors.placeholder}
                    strokeWidth={STROKE}
                    strokeDasharray={`${sliceLen} ${circumference - sliceLen}`}
                    strokeDashoffset={dashOffset}
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
          </Svg>
        </Animated.View>

        <View
          pointerEvents="none"
          style={[
            styles.centerFill,
            {
              left: centerX - centerFillRadius,
              top: centerY - centerFillRadius,
              width: centerFillRadius * 2,
              height: centerFillRadius * 2,
              borderRadius: centerFillRadius,
              backgroundColor: colors.base200,
            },
          ]}
        />

        <View
          style={[styles.centerWrap, { left: centerX - avatarSize / 2, top: centerY - avatarSize / 2 }]}
          pointerEvents="none"
        >
          <UserAvatar userId={userId} username={username} profilePicUrl={profilePicUrl} size={avatarSize} disabled />
        </View>

        {Array.from(chips.values()).map((chip) => {
          const isSelected = selectedSet.has(chip.genre);
          const sliceColor = slices.list.find((s) => s.genre === chip.genre)?.color;
          const color = sliceColor ?? colors.placeholder;
          const chipCenterX = chip.left + chip.width / 2;
          const chipCenterY = chip.top + chip.height / 2;
          const restOpacity = chip.hasData ? 1 : 0.5;
          const translateX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, centerX - chipCenterX] });
          const translateY = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, centerY - chipCenterY] });
          const opacity = collapseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [restOpacity, restOpacity, 0] });
          return (
            <Animated.View
              key={chip.genre}
              pointerEvents={suppressInteraction ? "none" : "auto"}
              style={[
                styles.chip,
                { left: chip.left, top: chip.top },
                {
                  borderColor: color,
                  borderWidth: isSelected ? 2 : 1.5,
                  backgroundColor: isSelected ? color : colors.base200,
                },
                { transform: [{ translateX }, { translateY }], opacity },
              ]}
            >
              <Pressable
                onPress={() => onToggleGenre(chip.genre)}
                onLayout={(e) => handleChipLayout(chip.genre, e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
                style={styles.chipPress}
              >
                <Text style={[styles.chipText, { color: isSelected ? "#2b2b2b" : color }]} numberOfLines={1}>
                  {chip.genre}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
