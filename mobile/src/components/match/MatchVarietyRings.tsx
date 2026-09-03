import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
// Same fix as PosterCoverflow.tsx: this row nests inside MatchAnalysisPanel's
// own card-paging ScrollView (same horizontal axis) — a plain RN ScrollView
// loses the drag gesture to the outer one.
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import UserAvatar from "../UserAvatar";
import { getCineGraph } from "../../api/userService";
import { genreColor, hexLuminance } from "./CineMatchGenreRing";
import { categoryMeta } from "./matchCategoryMeta";
import type { CineGraphStats, SwipeCandidate } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { fonts } from "../../theme/typography";

// Same wrapping PosterCoverflow.tsx already needs and explains in its own
// comment — gesture-handler's ScrollView isn't itself an Animated component,
// so a native-driven onScroll AnimatedEvent has to be attached through
// createAnimatedComponent, not passed to it directly.
const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

const RING_GAP = 24;
const MAX_RING_SIZE = 130;
const MIN_RING_SIZE = 96;
const RING_STROKE_RATIO = 0.16;

const CHIP_HEIGHT = 34;
const CHIP_GAP = 12;
const CHIP_CENTER_SCALE = 1.08;
const CHIP_H_PADDING = 14;
const MIN_CHIP_WIDTH = 54;
// Text-length estimate, not a measured layout — good enough for a pill
// whose only job is "roughly as wide as its own word" (this codebase's own
// CineGraphDonut/CineMatchGenreRing chips fall back to an near-identical
// formula before their first real onLayout measurement lands); estimating
// only avoids the "chip visibly resizes right after mount" jitter those
// two files have to specifically freeze against once real measurements
// arrive, at the cost of not being pixel-exact.
const CHAR_WIDTH_ESTIMATE = 6.8;
const chipWidthFor = (genre: string) => Math.max(MIN_CHIP_WIDTH, Math.round(genre.length * CHAR_WIDTH_ESTIMATE) + CHIP_H_PADDING * 2);
// The coverflow's own resting slot before the first genre — deliberately
// blank, no chip inside it. At rest (no scroll yet) this is what's centered,
// not any genre, so nothing is selected: every ring shows its own full,
// undimmed colors, and the detail readout below shows each person's overall
// total instead of one genre's count.
const EMPTY_SLOT_WIDTH = 64;

interface SliceItem {
  genre: string;
  count: number;
  boundary: number;
}

interface RingProps {
  stats: CineGraphStats;
  size: number;
  colorByGenre: Map<string, string>;
  selectedGenre: string | null;
  userId: string;
  username: string;
  profilePicUrl?: string;
}

// A smaller, non-interactive copy of Profile's own CineGraphDonut.tsx (the
// exact ring the CineGraph tab already shows, on both the current user's
// own profile and other users' public ones) — same ring-drawing technique
// (one full circle per genre, only a count-proportional arc ever visible
// via strokeDasharray/strokeDashoffset), fed with each person's real,
// already-existing CineGraph data via the same getCineGraph endpoint that
// tab already calls, not a new backend computation.
//
// Deliberately inert on its own — no tap, no rotation. Selection lives
// entirely in the genre coverflow below both rings (GenreCoverflow), which
// is the only thing that changes `selectedGenre`; a ring's own job is just
// to reflect it — the matching slice (if this person has it at all) keeps
// its assigned color, every other slice in both rings dims to gray at once.
function GenreRing({ stats, size, colorByGenre, selectedGenre, userId, username, profilePicUrl }: RingProps) {
  const { colors } = useTheme();

  const stroke = size * RING_STROKE_RATIO;
  const center = size / 2;
  const ringRadius = center - stroke / 2 - 3;
  const circumference = 2 * Math.PI * ringRadius;
  const avatarSize = size - stroke * 2 - 10;

  const slices = useMemo(() => {
    const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return { total: 0, list: [] as SliceItem[] };
    let acc = 0;
    const list: SliceItem[] = entries.map(([genre, count]) => {
      const boundary = (acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += count;
      return { genre, count, boundary };
    });
    return { total, list };
  }, [stats]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: { width: size, height: size },
        avatarWrap: { position: "absolute", left: center - avatarSize / 2, top: center - avatarSize / 2 },
      }),
    [size, center, avatarSize]
  );

  let offset = 0;

  return (
    <View style={styles.box}>
      <Svg width={size} height={size}>
        {slices.total > 0 ? (
          slices.list.map((s) => {
            const sliceLen = (s.count / slices.total) * circumference;
            const dashOffset = -offset + circumference * 0.25;
            offset += sliceLen;
            const isDimmed = selectedGenre !== null && selectedGenre !== s.genre;
            const color = isDimmed ? colors.placeholder : colorByGenre.get(s.genre) ?? colors.placeholder;
            return (
              <Circle
                key={s.genre}
                cx={center}
                cy={center}
                r={ringRadius}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${sliceLen} ${circumference - sliceLen}`}
                strokeDashoffset={dashOffset}
              />
            );
          })
        ) : (
          <Circle cx={center} cy={center} r={ringRadius} fill="none" stroke={colors.border} strokeWidth={stroke} />
        )}
        {slices.list.length > 1 &&
          slices.list.map((s) => {
            const innerR = ringRadius - stroke / 2;
            const outerR = ringRadius + stroke / 2;
            return (
              <Line
                key={s.genre}
                x1={center + innerR * Math.cos(s.boundary)}
                y1={center + innerR * Math.sin(s.boundary)}
                x2={center + outerR * Math.cos(s.boundary)}
                y2={center + outerR * Math.sin(s.boundary)}
                stroke={colors.base100}
                strokeWidth={1.5}
              />
            );
          })}
      </Svg>
      <View style={styles.avatarWrap} pointerEvents="none">
        <UserAvatar userId={userId} username={username} profilePicUrl={profilePicUrl} size={avatarSize} disabled />
      </View>
    </View>
  );
}

interface GenreCoverflowProps {
  genres: string[];
  colorByGenre: Map<string, string>;
  // null reports "resting on the leading empty slot" — no genre focused.
  onFocusChange: (genre: string | null) => void;
}

interface Slot {
  key: string;
  genre: string | null;
  width: number;
}

// The exact same center-focus coverflow mechanic as PosterCoverflow.tsx —
// scrolling brings an item to the middle, and whichever one is centered
// auto-reports itself as focused (no tap involved) — applied to genre pills
// instead of posters, with two real differences from that file's own fixed-
// pitch version: pills are sized to their own word length instead of one
// shared width, and there's a genuine leading item with nothing in it
// (`EMPTY_SLOT_WIDTH`) — where the scroll rests by default, before the
// first real genre — so "nothing selected yet" is a real, reachable
// position, not something represented by an out-of-range index.
//
// Variable widths mean the fixed-`pitch`/`snapToInterval` math PosterCoverflow
// uses doesn't apply here: each slot's own centering scroll offset (`offsets`
// below) is computed from the *cumulative* widths of everything before it,
// snapping uses that per-slot `snapToOffsets` array instead of one shared
// interval, and the scroll listener picks whichever precomputed offset the
// live scroll position is currently closest to.
function GenreCoverflow({ genres, colorByGenre, onFocusChange }: GenreCoverflowProps) {
  const { colors } = useTheme();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [centerIndex, setCenterIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const focusedIndexRef = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width);

  const slots = useMemo<Slot[]>(
    () => [{ key: "__empty__", genre: null, width: EMPTY_SLOT_WIDTH }, ...genres.map((g) => ({ key: g, genre: g, width: chipWidthFor(g) }))],
    [genres]
  );

  // Each slot's own center, in content coordinates (before the centering
  // padding below is added) — driven purely by the real widths above it,
  // since slots are no longer a uniform size.
  const centers = useMemo(() => {
    let cum = 0;
    const c: number[] = [];
    slots.forEach((s, i) => {
      c.push(cum + s.width / 2);
      cum += s.width + (i < slots.length - 1 ? CHIP_GAP : 0);
    });
    return c;
  }, [slots]);

  // How far to scroll so slot i's own center lands on the viewport's
  // center — half the viewport, minus how far into the (padded) content
  // that slot's center already sits without any scrolling.
  const leadingPad = viewportWidth / 2 - (slots[0]?.width ?? 0) / 2;
  const offsets = useMemo(() => centers.map((c) => leadingPad + c - viewportWidth / 2), [centers, leadingPad, viewportWidth]);
  const trailingPad = Math.max(0, viewportWidth / 2 - (slots[slots.length - 1]?.width ?? 0) / 2);

  useEffect(() => {
    if (viewportWidth === 0 || offsets.length === 0) return;
    const id = scrollX.addListener(({ value }) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      offsets.forEach((offset, i) => {
        const dist = Math.abs(value - offset);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      if (bestIdx !== focusedIndexRef.current) {
        focusedIndexRef.current = bestIdx;
        setCenterIndex(bestIdx);
        onFocusChange(slots[bestIdx].genre);
      }
    });
    return () => scrollX.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsets, slots]);

  // Fresh genre list (a different candidate) — rest on the leading empty
  // slot again, matching where the scroll position (still 0 on a fresh
  // mount, this component is remounted via a `key` on candidate switch)
  // sits: nothing focused.
  useEffect(() => {
    focusedIndexRef.current = 0;
    setCenterIndex(0);
    onFocusChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genres.join(",")]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%" },
        row: { alignItems: "center" },
        item: { alignItems: "center", justifyContent: "center" },
        chip: { height: CHIP_HEIGHT, borderRadius: CHIP_HEIGHT / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: CHIP_H_PADDING },
        chipText: { fontSize: 11.5, fontFamily: fonts.medium, textAlign: "center" },
      }),
    [colors]
  );

  if (genres.length === 0) return null;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {viewportWidth > 0 && (
        <AnimatedGHScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={offsets}
          decelerationRate="fast"
          contentContainerStyle={[styles.row, { paddingLeft: leadingPad, paddingRight: trailingPad, gap: CHIP_GAP, height: CHIP_HEIGHT + 8 }]}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
          {slots.map((slot, i) => {
            if (!slot.genre) {
              return <View key={slot.key} style={[styles.item, { width: slot.width }]} />;
            }
            const scale = scrollX.interpolate({
              inputRange: [offsets[i - 1] ?? offsets[i], offsets[i], offsets[i + 1] ?? offsets[i]],
              outputRange: [1, CHIP_CENTER_SCALE, 1],
              extrapolate: "clamp",
            });
            const isCentered = i === centerIndex;
            const color = colorByGenre.get(slot.genre) ?? colors.placeholder;
            return (
              <View key={slot.key} style={[styles.item, { width: slot.width, zIndex: isCentered ? 10 : 0 }]}>
                <Animated.View
                  style={[
                    styles.chip,
                    { borderColor: color, backgroundColor: isCentered ? color : colors.base100, transform: [{ scale }] },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isCentered ? "#2b2b2b" : color }]} numberOfLines={1}>
                    {slot.genre}
                  </Text>
                </Animated.View>
              </View>
            );
          })}
        </AnimatedGHScrollView>
      )}
    </View>
  );
}

interface Props {
  candidate: SwipeCandidate;
  // The Sync search's own active genre filter (MatchFilters.genres) — empty
  // means no filter, matching that same convention everywhere else it's
  // used (computeMatchBreakdown's own `if (genres.length && ...)` guard).
  // getCineGraph itself has no genre-scoping support (it returns every
  // genre's stats always), so this narrows the already-fetched result down
  // to just the active genres client-side, rather than needing any backend
  // change — the same reasoning genre-filtering matchInsights.sharedGenres/
  // favoritesOverlap already applies server-side, just done here instead
  // since this card's own data source can't take a filter param.
  activeGenres: string[];
}

// Real counts for just the active genre filter (or every genre, when no
// filter is active) — everything this component derives for display
// (colors, ranking, ring slices, totals) reads from this, not the raw
// fetched stats, so the whole card narrows consistently the same way
// Shared Genres/Favorites already do when a filter is active.
function filterStats(stats: CineGraphStats | null, activeGenres: string[]): CineGraphStats | null {
  if (!stats) return null;
  if (activeGenres.length === 0) return stats;
  return Object.fromEntries(Object.entries(stats).filter(([genre]) => activeGenres.includes(genre)));
}

export default function MatchVarietyRings({ candidate, activeGenres }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();

  const bgLuminance = useMemo(() => hexLuminance(colors.base100), [colors.base100]);
  const [rowWidth, setRowWidth] = useState(0);
  const ringSize = Math.max(MIN_RING_SIZE, Math.min(MAX_RING_SIZE, (rowWidth - RING_GAP) / 2));

  const [myStats, setMyStats] = useState<CineGraphStats | null>(null);
  const [theirStats, setTheirStats] = useState<CineGraphStats | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const isMovie = candidate.contentType === "movie";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getCineGraph(user._id)
      .then((data) => {
        if (!cancelled) setMyStats(isMovie ? data.movieStats : data.seriesStats);
      })
      .catch(() => {
        if (!cancelled) setMyStats({});
      });
    return () => {
      cancelled = true;
    };
  }, [user, isMovie]);

  useEffect(() => {
    let cancelled = false;
    getCineGraph(candidate.user._id)
      .then((data) => {
        if (!cancelled) setTheirStats(isMovie ? data.movieStats : data.seriesStats);
      })
      .catch(() => {
        if (!cancelled) setTheirStats({});
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.user._id, isMovie]);

  const filteredMyStats = useMemo(() => filterStats(myStats, activeGenres), [myStats, activeGenres]);
  const filteredTheirStats = useMemo(() => filterStats(theirStats, activeGenres), [theirStats, activeGenres]);

  // One color per genre, shared by both rings and the coverflow chips —
  // computed across the union of everything either person has (within the
  // active filter, if any), ranked by combined count so the coverflow's own
  // left-to-right order matches how prominent a genre is between the two.
  const { colorByGenre, rankedGenres } = useMemo(() => {
    if (!filteredMyStats || !filteredTheirStats) return { colorByGenre: new Map<string, string>(), rankedGenres: [] as string[] };
    const totals = new Map<string, number>();
    const add = (stats: CineGraphStats) => Object.entries(stats).forEach(([g, c]) => totals.set(g, (totals.get(g) || 0) + c));
    add(filteredMyStats);
    add(filteredTheirStats);
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const map = new Map<string, string>();
    ranked.forEach((genre, i) => map.set(genre, genreColor(i, ranked.length, bgLuminance)));
    return { colorByGenre: map, rankedGenres: ranked };
  }, [filteredMyStats, filteredTheirStats, bgLuminance]);

  // Resting on the coverflow's leading empty slot (selectedGenre === null)
  // shows each person's overall total instead of any one genre's count —
  // the same "nothing focused yet" state the rings themselves also reflect
  // by leaving every slice at its own full color. "Total" itself already
  // respects the active filter, since it sums the filtered stats.
  const totalMine = useMemo(() => (filteredMyStats ? Object.values(filteredMyStats).reduce((sum, n) => sum + n, 0) : 0), [filteredMyStats]);
  const totalTheirs = useMemo(
    () => (filteredTheirStats ? Object.values(filteredTheirStats).reduce((sum, n) => sum + n, 0) : 0),
    [filteredTheirStats]
  );
  const myCount = selectedGenre ? filteredMyStats?.[selectedGenre] ?? 0 : totalMine;
  const theirCount = selectedGenre ? filteredTheirStats?.[selectedGenre] ?? 0 : totalTheirs;
  const currentColor = selectedGenre ? colorByGenre.get(selectedGenre) ?? colors.baseContent : colors.baseContent;
  const unitLabel = isMovie ? t("movies") : t("series");

  const loaded = myStats !== null && theirStats !== null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        desc: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18, marginBottom: 16, textAlign: "center" },
        ringsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: RING_GAP, marginBottom: 16 },
        // Same sizing/spacing as MatchAnalysisPanel's own Shared Genres
        // poster detail (ratingColumn/ratingName/ratingText) — per direct
        // ask that these headers match that card's, not this card's own
        // earlier, smaller styling.
        detailRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 16 },
        detailColumn: { alignItems: "center", gap: 8, maxWidth: "45%" },
        detailName: { fontFamily: fonts.bold, fontSize: 14, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
        detailText: { fontSize: 15, fontFamily: fonts.medium, color: colors.baseContent },
      }),
    [colors]
  );

  return (
    <View>
      <Text style={styles.desc}>{categoryMeta("diversity", colors, t).desc}</Text>

      <View style={styles.ringsRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {rowWidth > 0 && loaded && (
          <>
            <GenreRing
              stats={filteredMyStats!}
              size={ringSize}
              colorByGenre={colorByGenre}
              selectedGenre={selectedGenre}
              userId={user?._id ?? ""}
              username={user?.username ?? ""}
              profilePicUrl={user?.profile_pic_url}
            />
            <GenreRing
              stats={filteredTheirStats!}
              size={ringSize}
              colorByGenre={colorByGenre}
              selectedGenre={selectedGenre}
              userId={candidate.user._id}
              username={candidate.user.username}
              profilePicUrl={candidate.user.profile_pic_url}
            />
          </>
        )}
      </View>

      {loaded && rankedGenres.length > 0 && (
        <>
          <GenreCoverflow key={candidate.user._id} genres={rankedGenres} colorByGenre={colorByGenre} onFocusChange={setSelectedGenre} />

          <View style={styles.detailRow}>
            <View style={styles.detailColumn}>
              <Text style={[styles.detailName, { color: currentColor }]} numberOfLines={1}>
                {t("You")}
              </Text>
              <Text style={styles.detailText}>
                {myCount} {unitLabel}
              </Text>
            </View>
            <View style={styles.detailColumn}>
              <Text style={[styles.detailName, { color: currentColor }]} numberOfLines={1} ellipsizeMode="tail">
                {candidate.user.username}
              </Text>
              <Text style={styles.detailText}>
                {theirCount} {unitLabel}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
