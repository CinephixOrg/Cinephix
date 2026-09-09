import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  Animated,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MatchGradientTitle from "../match/MatchGradientTitle";
import { genreColor, hexLuminance } from "../match/CineMatchGenreRing";
import GenreDonutChart from "./GenreDonutChart";
import AnalysisGenreBars, { DELTA_NOISE_FLOOR, type GenreBarItem } from "./AnalysisGenreBars";
import AnalysisPosterRow from "./AnalysisPosterRow";
import AnalysisStatsGrid, { type StatTileDef } from "./AnalysisStatsGrid";
import AnalysisColumnChart, { type ChartColumn } from "./AnalysisColumnChart";
import { analysisCardMinTier, tierAllows } from "./analysisCardAccess";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { formatFiveScale } from "../../utils/rating";
import type {
  AccountTier,
  MonthlyStatPair,
  ProfileAnalysis,
  ProfileAnalysisItem,
  ProfileAnalysisStats,
} from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const CARD_GAP = 12;
const HORIZONTAL_PADDING = 18;
const IDEAL_CARD_HEIGHT = 540;
const MAX_CARD_HEIGHT_RATIO = 0.64;
// How many posters a collapsed strip shows before "See all" is worth
// offering. Roughly two screens' worth of sideways scrolling.
const COLLAPSED_ITEM_COUNT = 6;

// Everything the deck needs to look untouched after the user taps a poster,
// visits that title's page, and comes back. The deck itself unmounts while
// that happens (an RN Modal drops its children when hidden), so this lives
// in a ref owned by ProfileAnalysisModal, which stays mounted throughout.
export interface AnalysisDeckState {
  activeIndex: number;
  revealedKeys: string[];
  // Per-card selected genre / rating / month, keyed by card key.
  selectionByCard: Record<string, string | null>;
}

export const createAnalysisDeckState = (): AnalysisDeckState => ({
  activeIndex: 0,
  revealedKeys: [],
  selectionByCard: {},
});

interface CardDef {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  // Lowest account tier that may see this card. Sourced from one table
  // (analysisCardAccess.ts) rather than inlined here, so restricting a page
  // later is a one-word edit there instead of surgery on this render logic.
  minTier: AccountTier;
  // `revealed` = this card has been reached at least once. Deliberately
  // sticky rather than "is the current card": every card stays mounted, and
  // replaying a chart's build-up every time the user swipes past it got
  // tiring fast. Charts animate in on first sight and then stay settled.
  render: (revealed: boolean) => ReactNode;
}

// Shared by every data-driven card body below.
interface BodyProps {
  stats: ProfileAnalysisStats;
  bgLuminance: number;
  active: boolean;
  // Which genre / rating / month this card had focused last time it was on
  // screen. Each body owns its own selection state seeded from this, and
  // reports changes back through onSelectionChange, which the deck parks in
  // a ref that outlives the modal being hidden. Keeping the state IN the
  // body (rather than lifted into the deck) means tapping a genre
  // re-renders that one card instead of rebuilding all eight.
  initialSelection: string | null;
  onSelectionChange: (next: string | null) => void;
  onOpenItem?: (item: ProfileAnalysisItem) => void;
}

// Selection state + write-through to the deck's persisted ref. Extracted
// because all five interactive cards need exactly this.
function usePersistedSelection(initial: string | null, onChange: (next: string | null) => void) {
  const [selection, setSelection] = useState<string | null>(initial);
  const select = useCallback(
    (next: string | null) => {
      setSelection((prev) => {
        const resolved = prev === next ? null : next;
        onChange(resolved);
        return resolved;
      });
    },
    [onChange]
  );
  return [selection, select] as const;
}

// ---------------------------------------------------------------------------
// Card bodies
// ---------------------------------------------------------------------------

// Card 1: the only LLM-authored card in the deck. Everything after this one
// is computed from real rating data.
function PersonaBody({ data, active }: { data: ProfileAnalysis; active: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { opacity, translateY } = useRevealAnimation(active ? "persona" : null);

  // The nickname lands with a small overshoot rather than fading in with the
  // rest — the same "this is the headline" emphasis MatchTitleBadge gives
  // CineMatch's match title, dialled well down (no rotation, no oversized
  // start) since this one sits inline in the card rather than as a sticker.
  const stamp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    stamp.setValue(0);
    Animated.spring(stamp, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [active, stamp]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Text style={styles.eyebrow}>{`✨ ${t("AI Cinematic Persona")}`.toUpperCase()}</Text>
      <Animated.View
        style={{ transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }}
      >
        <MatchGradientTitle
          text={data.nickname || t("Silent Observer")}
          gradientId="profileAnalysisNicknameGradient"
          fontSize={21}
        />
      </Animated.View>

      {data.tasteCategory && (
        <View style={styles.tasteChip}>
          <Text style={styles.tasteChipText}>{data.tasteCategory}</Text>
        </View>
      )}
      <Text style={styles.paragraph}>{data.personalitySummary}</Text>

      {data.trendVsLastAnalysis && (
        <View style={styles.subsection}>
          <Text style={styles.sectionLabel}>{`📈 ${t("Since Last Time")}`.toUpperCase()}</Text>
          <Text style={styles.paragraph}>{data.trendVsLastAnalysis}</Text>
        </View>
      )}

      <View style={styles.subsection}>
        <Text style={styles.sectionLabel}>{`💡 ${t("Recommended Vibe")}`.toUpperCase()}</Text>
        <Text style={styles.paragraph}>{data.recommendedConcept}</Text>
      </View>

      <View style={styles.funFactBox}>
        <Text style={styles.sectionLabel}>{`🍿 ${t("Did You Know?")}`.toUpperCase()}</Text>
        <Text style={styles.funFactText}>"{data.funFact}"</Text>
      </View>
    </Animated.View>
  );
}

// Card 2: the donut, its legend, and the sentences that prove the numbers
// are real. Tapping a legend row focuses that genre — the arc thickens, the
// others dim, and the titles behind it appear underneath.
const GenreBreakdownBody = memo(function GenreBreakdownBody({
  stats,
  bgLuminance,
  active,
  initialSelection,
  onSelectionChange,
  onOpenItem,
}: BodyProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [selection, onSelect] = usePersistedSelection(initialSelection, onSelectionChange);

  const genreBreakdown = stats.genreBreakdown ?? [];
  const totalRatings = stats.totalRatings ?? stats.movies.watchedCount + stats.series.watchedCount;
  const tagTotal = stats.genreTagTotal ?? genreBreakdown.reduce((sum, g) => sum + g.count, 0);
  const focused = selection ? genreBreakdown.find((g) => g.genre === selection) ?? null : null;
  const focusedIndex = focused ? genreBreakdown.findIndex((g) => g.genre === focused.genre) : null;
  // Replays whenever the focus changes, so the middle of the ring swaps with
  // a soft fade instead of snapping between labels.
  const { opacity: centerOpacity } = useRevealAnimation(focused?.genre ?? "all", 320);
  const focusedItems = focused ? stats.genreItems?.[focused.genre] ?? [] : [];

  // Whatever the top few genres don't account for, named rather than left
  // as an unexplained gap: six slices summing to 69% with no "Other" row
  // just reads as the chart having lost 31% somewhere.
  const listedTags = genreBreakdown.reduce((sum, g) => sum + g.count, 0);
  const otherCount = Math.max(0, tagTotal - listedTags);
  const otherPercentage = tagTotal ? Math.round((otherCount / tagTotal) * 100) : 0;
  const donutSegments = useMemo(
    () =>
      otherCount > 0
        ? [...genreBreakdown, { genre: t("Other"), count: otherCount, color: colors.base300 }]
        : genreBreakdown,
    [genreBreakdown, otherCount, colors.base300, t]
  );

  if (genreBreakdown.length === 0) {
    return <Text style={styles.emptyText}>{t("Rate a few movies or shows to see your genre breakdown.")}</Text>;
  }

  return (
    <View>
      {/* Spells out the scope the card covers — it's every rating ever, both
          types pooled, which isn't guessable from the chart itself. */}
      <Text style={styles.cardSubtitle}>
        {t("All time · movies and series · {{count}} rated titles", { count: totalRatings })}
      </Text>

      <View style={styles.donutRow}>
        <GenreDonutChart
          segments={donutSegments}
          bgLuminance={bgLuminance}
          active={active}
          selectedIndex={focusedIndex}
        />
        <Animated.View style={[styles.donutCenterOverlay, { opacity: centerOpacity }]} pointerEvents="none">
          {/* Unfocused, the middle reports the whole dataset rather than
              silently adopting the biggest slice's number — that read as if
              the chart were claiming "you are 31% Drama" overall. */}
          <Text style={styles.donutCenterValue}>{focused ? `${focused.percentage}%` : totalRatings}</Text>
          <Text style={styles.donutCenterLabel} numberOfLines={2}>
            {focused ? focused.genre : t("rated titles")}
          </Text>
        </Animated.View>
      </View>

      {/* Two numbers, two denominators, both spelled out: the title count is
          out of rated titles, the ring's percentage is out of genre tags.
          Left implicit, "37 of your 45 titles" sitting next to "31%" just
          reads as broken arithmetic. */}
      {focused && (
        <Animated.Text style={[styles.groundingText, { opacity: centerOpacity }]}>
          {t("{{count}} of your {{total}} rated titles are tagged {{genre}}.", {
            count: focused.count,
            total: totalRatings,
            genre: focused.genre,
          })}
        </Animated.Text>
      )}
      <Text style={styles.footnote}>
        {t("Most titles carry 2-3 genres, so the ring shows each genre's share of all {{count}} genre tags.", {
          count: tagTotal,
        })}
      </Text>

      <View style={styles.legendWrap}>
        {genreBreakdown.map((g, i) => {
          const isSelected = selection === g.genre;
          return (
            <Pressable
              key={g.genre}
              onPress={() => onSelect(g.genre)}
              style={[styles.legendRow, isSelected && styles.legendRowSelected]}
            >
              <View style={[styles.legendDot, { backgroundColor: genreColor(i, donutSegments.length, bgLuminance) }]} />
              <Text style={[styles.legendLabel, isSelected && styles.legendLabelSelected]} numberOfLines={1}>
                {g.genre}
              </Text>
              <Text style={styles.legendCount}>{t("{{count}} titles", { count: g.count })}</Text>
              <Text style={styles.legendPercent}>{g.percentage}%</Text>
            </Pressable>
          );
        })}
        {otherCount > 0 && (
          // Inert on purpose: "Other" is an aggregate of everything outside
          // the top six, so there's no single list of titles to reveal.
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.base300 }]} />
            <Text style={[styles.legendLabel, styles.legendLabelMuted]} numberOfLines={1}>
              {t("Other")}
            </Text>
            <Text style={styles.legendCount}>{t("{{count}} titles", { count: otherCount })}</Text>
            <Text style={styles.legendPercent}>{otherPercentage}%</Text>
          </View>
        )}
      </View>

      {selection === null && <Text style={styles.hintText}>{t("Tap a genre to focus it.")}</Text>}

      {focusedItems.length > 0 && (
        <View style={styles.posterSection}>
          <Text style={styles.sectionLabel}>
            {t("Your top {{genre}} picks", { genre: focused?.genre ?? "" }).toUpperCase()}
          </Text>
          {/* Keyed by genre so the row remounts on every selection change —
              that's what re-runs its stagger, giving each newly-picked genre
              its own little deal-in instead of swapping posters in place. */}
          <AnalysisPosterRow
            key={focused?.genre}
            items={focusedItems}
            gradientId="analysisGenrePosterFade"
            active={active}
            onPressItem={onOpenItem}
          />
        </View>
      )}
    </View>
  );
});

// Card 3: the last 30 days, as percentages and as the actual posters.
const RecentTasteBody = memo(function RecentTasteBody({
  stats,
  bgLuminance,
  active,
  initialSelection,
  onSelectionChange,
  onOpenItem,
}: BodyProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [selection, onSelect] = usePersistedSelection(initialSelection, onSelectionChange);

  const recentGenres = stats.recentGenres ?? [];
  const recentItems = stats.recentItems ?? [];
  const lead = recentGenres[0];
  const leadDelta = lead?.deltaVsPreviousPeriod;
  const showLeanCallout = typeof leadDelta === "number" && leadDelta >= DELTA_NOISE_FLOOR;
  const shownItems = selection ? recentItems.filter((item) => item.genres?.includes(selection)) : recentItems;
  // Older history rows only carry the all-time comparison; the arrows are
  // labelled "vs last month", so they only show when that's what they are.
  const hasMonthlyDelta = recentGenres.some((g) => typeof g.deltaVsPreviousPeriod === "number");

  if (recentGenres.length === 0) {
    return (
      <Text style={styles.emptyText}>{t("Rate a few movies or shows to see what you've been into lately.")}</Text>
    );
  }

  const bars: GenreBarItem[] = recentGenres.map((g) => ({
    genre: g.genre,
    percentage: g.percentage,
    valueLabel: String(g.count),
    delta: hasMonthlyDelta ? g.deltaVsPreviousPeriod ?? undefined : undefined,
  }));

  return (
    <View>
      {showLeanCallout ? (
        <Text style={styles.groundingText}>
          {t("You've been especially into {{genre}} lately — {{delta}}% more than last month.", {
            genre: lead.genre,
            delta: leadDelta,
          })}
        </Text>
      ) : (
        <Text style={styles.cardSubtitle}>{t("What you've rated in the last 30 days.")}</Text>
      )}

      <AnalysisGenreBars
        items={bars}
        bgLuminance={bgLuminance}
        active={active}
        selectedGenre={selection}
        onSelectGenre={onSelect}
      />

      {hasMonthlyDelta && (
        <Text style={styles.footnote}>{t("↑↓ compares each genre with the previous 30 days.")}</Text>
      )}

      {selection === null && <Text style={styles.hintText}>{t("Tap a genre to filter the titles below.")}</Text>}

      {shownItems.length > 0 && (
        <View style={styles.posterSection}>
          <Text style={styles.sectionLabel}>
            {(selection ? t("Recent {{genre}} picks", { genre: selection }) : t("Recently Rated")).toUpperCase()}
          </Text>
          <AnalysisPosterRow
            key={selection ?? "all"}
            items={shownItems}
            gradientId="analysisRecentPosterFade"
            active={active}
            onPressItem={onOpenItem}
          />
        </View>
      )}
    </View>
  );
});

// Card 4: favorite weighting, whether it matches what they actually watch,
// and the favorites themselves.
const FavoriteGenresBody = memo(function FavoriteGenresBody({
  stats,
  bgLuminance,
  active,
  initialSelection,
  onSelectionChange,
  onOpenItem,
}: BodyProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [selection, onSelect] = usePersistedSelection(initialSelection, onSelectionChange);

  const favItems = stats.favoriteGenres?.items ?? [];
  const totalFavorites = stats.favoriteGenres?.totalFavorites ?? 0;
  const alignsWithTopWatched = stats.favoriteGenres?.alignsWithTopWatched ?? false;
  const favoriteItems = stats.favoriteItems ?? [];
  const hasWatchedGenres = (stats.genreBreakdown ?? []).length > 0;
  const shownItems = selection ? favoriteItems.filter((item) => item.genres?.includes(selection)) : favoriteItems;

  // Same "name the leftover" fix as the Genre Breakdown card — a top-5 list
  // that stops at 78% has to say where the other 22% went.
  const tagTotal = stats.favoriteGenres?.tagTotal ?? 0;
  const listedTags = favItems.reduce((sum, g) => sum + (g.count ?? 0), 0);
  const otherCount = tagTotal && listedTags ? Math.max(0, tagTotal - listedTags) : 0;
  const otherPercentage = tagTotal && otherCount ? Math.round((otherCount / tagTotal) * 100) : 0;

  if (favItems.length === 0) {
    return <Text style={styles.emptyText}>{t("Add a few favorites to see what genres you lean on most.")}</Text>;
  }

  const bars: GenreBarItem[] = favItems.map((g) => ({
    genre: g.genre,
    percentage: g.percentage,
    valueLabel: `${g.percentage}%`,
  }));

  return (
    <View>
      <Text style={styles.cardSubtitle}>{t("{{count}} favorites tagged", { count: totalFavorites })}</Text>

      <AnalysisGenreBars
        items={bars}
        bgLuminance={bgLuminance}
        active={active}
        selectedGenre={selection}
        onSelectGenre={onSelect}
      />

      {otherPercentage > 0 && (
        <View style={styles.otherRow}>
          <Text style={styles.otherLabel}>{t("Other")}</Text>
          <View style={styles.otherTrack}>
            <View style={[styles.otherFill, { width: `${Math.max(otherPercentage, 2)}%` }]} />
          </View>
          <Text style={styles.otherValue}>{otherPercentage}%</Text>
        </View>
      )}

      {hasWatchedGenres && (
        <View style={styles.insightBox}>
          <Ionicons
            name={alignsWithTopWatched ? "checkmark-circle-outline" : "shuffle-outline"}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.insightText}>
            {alignsWithTopWatched
              ? t("This matches what you actually watch most — consistent taste.")
              : t("A different flavor than what you usually rate — nice range!")}
          </Text>
        </View>
      )}

      {selection === null && <Text style={styles.hintText}>{t("Tap a genre to filter the titles below.")}</Text>}

      {shownItems.length > 0 && (
        <View style={styles.posterSection}>
          <Text style={styles.sectionLabel}>
            {(selection ? t("Favorite {{genre}} picks", { genre: selection }) : t("In Your Favorites")).toUpperCase()}
          </Text>
          <AnalysisPosterRow
            key={selection ?? "all"}
            items={shownItems}
            gradientId="analysisFavoritePosterFade"
            active={active}
            onPressItem={onOpenItem}
          />
        </View>
      )}
    </View>
  );
});

// Card 6: this calendar month against the last complete one.
const MonthlyStatsBody = memo(function MonthlyStatsBody({ stats, active }: { stats: ProfileAnalysisStats; active: boolean }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const monthly = stats.monthlyStats;

  if (!monthly) {
    return <Text style={styles.emptyText}>{t("Run a new analysis to see this month's stats.")}</Text>;
  }

  const trendOf = (pair: MonthlyStatPair): StatTileDef["trend"] =>
    pair.value > pair.previous ? "up" : pair.value < pair.previous ? "down" : "flat";
  const countTile = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    pair: MonthlyStatPair
  ): StatTileDef => ({
    icon,
    label,
    value: String(pair.value),
    countTo: pair.value,
    trend: trendOf(pair),
    caption: t("{{count}} last month", { count: pair.previous }),
  });
  const ratingTile = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    pair: MonthlyStatPair
  ): StatTileDef => ({
    icon,
    label,
    value: pair.value ? `${formatFiveScale(pair.value)}/5` : "—",
    ...(pair.value ? { countTo: pair.value / 2, decimals: 1, suffix: "/5" } : {}),
    trend: trendOf(pair),
    caption: pair.previous
      ? t("{{count}} last month", { count: formatFiveScale(pair.previous) })
      : t("Nothing last month"),
  });

  const start = new Date(monthly.periodStart);
  const end = new Date(monthly.periodEnd);
  const period = `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString(i18n.language, {
    month: "short",
    year: "numeric",
  })}`;

  // Order is fixed by design: activity first, then how it was scored, then
  // social, then everything else, with the period last as a footer tile.
  const tiles: StatTileDef[] = [
    countTile("film-outline", t("Movies Watched"), monthly.moviesWatched),
    countTile("tv-outline", t("Series Watched"), monthly.seriesWatched),
    ratingTile("star-outline", t("Avg Movie Rating"), monthly.avgMovieRating),
    ratingTile("star-half-outline", t("Avg Series Rating"), monthly.avgSeriesRating),
    countTile("people-outline", t("New Followers"), monthly.followers),
    countTile("person-add-outline", t("New Following"), monthly.following),
    countTile("bookmark-outline", t("Watchlist"), monthly.watchlist),
    countTile("chatbubble-ellipses-outline", t("Reviews"), monthly.reviews),
    countTile("share-social-outline", t("Shares"), monthly.shares),
    { icon: "calendar-outline", label: t("Period"), value: period },
  ];

  return (
    <View>
      <Text style={styles.cardSubtitle}>{t("This month so far, compared with last month.")}</Text>
      <AnalysisStatsGrid tiles={tiles} active={active} />
    </View>
  );
});

// Premium card: how generously they score, as the actual 1-10 distribution
// rather than the single average the stats card already prints. Labelled on
// the 5-star scale the rest of the app uses.
const RatingCurveBody = memo(function RatingCurveBody({
  stats,
  active,
  initialSelection,
  onSelectionChange,
  onOpenItem,
}: Omit<BodyProps, "bgLuminance">) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [selection, onSelect] = usePersistedSelection(initialSelection, onSelectionChange);
  // Collapses back to a strip whenever a different bar is picked — "See all"
  // is a statement about one bucket, not a mode the card stays in.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [selection]);

  const curve = stats.ratingCurve ?? [];
  const totalRated = curve.reduce((sum, c) => sum + c.count, 0);
  if (totalRated === 0) {
    return <Text style={styles.emptyText}>{t("Rate a few titles to see your scoring habits.")}</Text>;
  }

  const peak = curve.reduce((best, c) => (c.count > best.count ? c : best), curve[0]);
  const weightedAvg = curve.reduce((sum, c) => sum + c.value * c.count, 0) / totalRated;
  // The three-way read the card leads with. Thresholds are on the raw 1-10
  // scale: a 7.5+ average means most things clear "good," a sub-6 average
  // means most things don't.
  const verdict =
    weightedAvg >= 7.5
      ? t("You're a generous scorer — most things you watch land well.")
      : weightedAvg <= 6
        ? t("You're a tough critic — a high score from you actually means something.")
        : t("You're a balanced scorer — you use the whole range.");

  const columns: ChartColumn[] = curve.map((c) => ({
    key: String(c.value),
    label: formatFiveScale(c.value),
    value: c.count,
    highlight: c.value === peak.value,
  }));
  const selectedItems = selection ? stats.ratingCurveItems?.[selection] ?? [] : [];
  // The bucket's real size, straight off the chart — may exceed how many
  // titles the analysis actually stored for it.
  const selectedCount = selection ? curve.find((c) => String(c.value) === selection)?.count ?? 0 : 0;
  const canExpand = selectedItems.length > COLLAPSED_ITEM_COUNT;
  const visibleItems = expanded ? selectedItems : selectedItems.slice(0, COLLAPSED_ITEM_COUNT);

  return (
    <View>
      <Text style={styles.cardSubtitle}>{t("How you spread your scores, out of 5 stars.")}</Text>
      <AnalysisColumnChart
        columns={columns}
        accent={colors.warning}
        active={active}
        selectedKey={selection}
        onSelect={onSelect}
      />
      <Text style={styles.groundingText}>
        {t("Your most-used score is {{score}}, and you average {{average}} across {{count}} rated titles.", {
          score: formatFiveScale(peak.value),
          average: formatFiveScale(Math.round(weightedAvg * 10) / 10),
          count: totalRated,
        })}
      </Text>
      <View style={styles.insightBox}>
        <Ionicons name="analytics-outline" size={16} color={colors.primary} />
        <Text style={styles.insightText}>{verdict}</Text>
      </View>

      {selection === null ? (
        <Text style={styles.hintText}>{t("Tap a bar to see what you scored there.")}</Text>
      ) : (
        selectedItems.length > 0 && (
          <View style={styles.posterSection}>
            <View style={styles.posterHeader}>
              <Text style={[styles.sectionLabel, styles.posterHeaderLabel]} numberOfLines={1}>
                {t("Titles you rated {{score}}", { score: formatFiveScale(Number(selection)) }).toUpperCase()}
              </Text>
              {/* Only offered when expanding would actually reveal something
                  we hold. An analysis generated before the per-bucket cap was
                  raised only stored COLLAPSED_ITEM_COUNT titles, so there's
                  genuinely nothing behind the button on that data — the
                  "showing X of Y" line below carries the truth instead. */}
              {canExpand && (
                <Pressable onPress={() => setExpanded((prev) => !prev)} hitSlop={8}>
                  <Text style={styles.seeAll}>
                    {expanded ? t("Show less") : t("See all ({{count}})", { count: selectedItems.length })}
                  </Text>
                </Pressable>
              )}
            </View>
            <AnalysisPosterRow
              key={`${selection}-${expanded ? "grid" : "row"}`}
              items={visibleItems}
              gradientId="analysisCurvePosterFade"
              active={active}
              onPressItem={onOpenItem}
              layout={expanded ? "grid" : "row"}
            />
            {/* The bar's real height can exceed what the analysis stored for
                it, so never let the row imply it's the whole bucket. */}
            {selectedCount > visibleItems.length && (
              <Text style={styles.footnote}>
                {t("Showing {{shown}} of {{total}}.", { shown: visibleItems.length, total: selectedCount })}
              </Text>
            )}
          </View>
        )
      )}
    </View>
  );
});

// Premium card: ratings per month for the last six months.
const ActivityTimelineBody = memo(function ActivityTimelineBody({
  stats,
  active,
  initialSelection,
  onSelectionChange,
  onOpenItem,
}: Omit<BodyProps, "bgLuminance">) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [selection, onSelect] = usePersistedSelection(initialSelection, onSelectionChange);

  const timeline = stats.activityTimeline ?? [];
  const total = timeline.reduce((sum, m) => sum + m.count, 0);
  if (timeline.length === 0) {
    return <Text style={styles.emptyText}>{t("Rate a few titles to see your activity over time.")}</Text>;
  }

  const busiest = timeline.reduce((best, m) => (m.count > best.count ? m : best), timeline[0]);
  const columns: ChartColumn[] = timeline.map((m) => ({
    key: m.month,
    // Month start comes over as an ISO date precisely so the label can be
    // built in the viewer's own locale here rather than shipped in English.
    label: new Date(m.month).toLocaleDateString(i18n.language, { month: "short" }),
    value: m.count,
    highlight: m.month === busiest.month && busiest.count > 0,
  }));
  const selectedItems = selection ? stats.timelineItems?.[selection] ?? [] : [];

  return (
    <View>
      <Text style={styles.cardSubtitle}>{t("Titles you rated each month.")}</Text>
      <AnalysisColumnChart
        columns={columns}
        accent={colors.info}
        active={active}
        selectedKey={selection}
        onSelect={onSelect}
      />
      <Text style={styles.groundingText}>
        {busiest.count > 0
          ? t("{{count}} ratings in the last 6 months — your busiest was {{month}} with {{peak}}.", {
              count: total,
              month: new Date(busiest.month).toLocaleDateString(i18n.language, { month: "long" }),
              peak: busiest.count,
            })
          : t("No ratings in the last 6 months yet.")}
      </Text>

      {selection === null ? (
        <Text style={styles.hintText}>{t("Tap a month to see what you rated then.")}</Text>
      ) : (
        selectedItems.length > 0 && (
          <View style={styles.posterSection}>
            <Text style={styles.sectionLabel}>
              {new Date(selection)
                .toLocaleDateString(i18n.language, { month: "long", year: "numeric" })
                .toUpperCase()}
            </Text>
            <AnalysisPosterRow
              key={selection}
              items={selectedItems}
              gradientId="analysisTimelinePosterFade"
              active={active}
              onPressItem={onOpenItem}
            />
          </View>
        )
      )}
    </View>
  );
});

// Shown in place of the two cards above for tiers that don't get them. The
// server never sends that data for those tiers, so this is keyed off its
// absence rather than off a tier string the client could be wrong about.
const PremiumTeaseBody = memo(function PremiumTeaseBody({ onUpgrade }: { onUpgrade?: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <View style={styles.lockedWrap}>
      <View style={styles.lockedIcon}>
        <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
      </View>
      <Text style={styles.lockedTitle}>{t("Two more cards with Premium")}</Text>
      <Text style={styles.lockedText}>
        {t("Premium adds your Rating Curve — how generously you score — and a 6-month timeline of everything you've rated.")}
      </Text>
      {onUpgrade && (
        <Pressable style={styles.lockedButton} onPress={onUpgrade}>
          <Text style={styles.lockedButtonText}>{t("Upgrade Account")}</Text>
        </Pressable>
      )}
    </View>
  );
});

// One page indicator, driven straight off the deck's scroll offset rather
// than off activeIndex.
//
// activeIndex only updates when a gesture *ends* (onMomentumScrollEnd /
// onScrollEndDrag), so a dot keyed on it sat perfectly still through the
// entire swipe and then teleported — which reads as dropped frames even
// though nothing was actually dropping. Interpolating `scrollX` instead
// means the dot tracks the card under your thumb continuously.
//
// Everything animated here is opacity + scaleX, the two things the native
// driver can own outright: once mounted, this costs the JS thread nothing
// per frame. (Width can't ride the native driver, which is why the active
// pill grows via scaleX inside a fixed-width slot instead — that also stops
// the row from reflowing every time the active dot changes.)
const DeckDot = memo(function DeckDot({
  scrollX,
  index,
  pageWidth,
  onPress,
  styles,
}: {
  scrollX: Animated.Value;
  index: number;
  pageWidth: number;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  // Clamped to at least 1px: interpolate() requires a strictly increasing
  // inputRange, and a zero/negative page width (possible for one frame if
  // the sheet measures oddly) would collapse all three stops together and
  // throw.
  const page = Math.max(1, pageWidth);
  const activeness = scrollX.interpolate({
    inputRange: [(index - 1) * page, index * page, (index + 1) * page],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.dotSlot}>
      <Animated.View
        style={[
          styles.dotIdle,
          { opacity: activeness.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.dotActivePill,
          {
            opacity: activeness,
            transform: [{ scaleX: activeness.interpolate({ inputRange: [0, 1], outputRange: [0.36, 1] }) }],
          },
        ]}
      />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

// Card-paging deck for a Profile Analysis result — same "one topic per
// swipeable card" structure as CineMatch's MatchAnalysisPanel (horizontal
// snap-scroll, dot pager, base200 cards with an uppercase section title),
// reused deliberately for visual consistency across the app's two AI/algo
// features, but its own composition: card 1 is the LLM narrative, and every
// card after it is computed straight from rating data — a tappable donut,
// 30-day trend bars, favorite weighting, all-time and monthly stat grids,
// and (on Premium) two tappable charts, each backed by the real posters
// behind the numbers.
export default function ProfileAnalysisCardDeck({
  data,
  containerWidth,
  viewerTier,
  onUpgrade,
  onOpenItem,
  stateRef,
}: {
  data: ProfileAnalysis;
  // The modal sheet's own measured content width, so a card fills exactly
  // that width the same way MatchAnalysisPanel's cards fill their parent's
  // — sourced from the caller rather than re-derived from the full screen
  // width here, which would disagree with the sheet's own padding.
  containerWidth: number;
  // Drives the per-card minTier gate (see analysisCardAccess.ts). Every card
  // is visible to every tier today; this is the seam for changing that.
  viewerTier?: AccountTier;
  // Closes the modal and heads to settings. Optional because the deck also
  // renders inside ChatRoom, where a received analysis isn't the viewer's
  // own upgrade decision to make.
  onUpgrade?: () => void;
  // Opens a title's detail page. Only wired where coming back to this modal
  // afterwards works (see ProfileAnalysisModal's `navigable`).
  onOpenItem?: (item: ProfileAnalysisItem) => void;
  // Survives this deck unmounting while the user is off looking at a title.
  stateRef?: MutableRefObject<AnalysisDeckState>;
}) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const cardHeight = Math.min(IDEAL_CARD_HEIGHT, screenHeight * MAX_CARD_HEIGHT_RATIO);
  const cardWidth = containerWidth - HORIZONTAL_PADDING * 2;
  const scrollRef = useRef<ScrollView>(null);
  // Live scroll offset, fed natively by Animated.event below. Only the page
  // dots read it, and they do so entirely on the UI thread.
  const scrollX = useRef(new Animated.Value(0)).current;
  const bgLuminance = useMemo(() => hexLuminance(colors.base100), [colors.base100]);
  const styles = useMemo(() => buildStyles(colors), [colors]);

  // Seeded from the caller's ref so a round trip to a title's page and back
  // lands on the same card, without replaying every chart's entrance.
  const [activeIndex, setActiveIndex] = useState(() => stateRef?.current.activeIndex ?? 0);
  const [revealedKeys, setRevealedKeys] = useState<string[]>(() => stateRef?.current.revealedKeys ?? []);

  useEffect(() => {
    if (!stateRef) return;
    stateRef.current = { ...stateRef.current, activeIndex, revealedKeys };
  }, [stateRef, activeIndex, revealedKeys]);

  // Per-card selection is written straight to the ref rather than held in
  // deck state: it only ever needs to survive a remount, and routing it
  // through state here would rebuild all eight cards on every genre tap.
  const selectionFor = useCallback(
    (key: string) => stateRef?.current.selectionByCard[key] ?? null,
    [stateRef]
  );
  // One stable callback per card key, so the memoized bodies actually stay
  // memoized instead of seeing a new function identity on each render.
  const selectHandlers = useRef(new Map<string, (next: string | null) => void>()).current;
  const selectFor = useCallback(
    (key: string) => {
      let handler = selectHandlers.get(key);
      if (!handler) {
        handler = (next: string | null) => {
          if (stateRef) stateRef.current.selectionByCard[key] = next;
        };
        selectHandlers.set(key, handler);
      }
      return handler;
    },
    [selectHandlers, stateRef]
  );

  const stats = data.stats;

  const cards = useMemo<CardDef[]>(() => {
    const list: CardDef[] = [
      {
        key: "ai-summary",
        title: t("Cinematic Persona"),
        icon: "sparkles-outline",
        accent: colors.primary,
        minTier: analysisCardMinTier("ai-summary"),
        render: (active) => <PersonaBody data={data} active={active} />,
      },
    ];

    if (!stats) return list;

    list.push({
      key: "genre-breakdown",
      title: t("Genre Breakdown"),
      icon: "pie-chart-outline",
      accent: colors.primary,
      minTier: analysisCardMinTier("genre-breakdown"),
      render: (active) => (
        <GenreBreakdownBody
          stats={stats}
          bgLuminance={bgLuminance}
          active={active}
          initialSelection={selectionFor("genre-breakdown")}
          onSelectionChange={selectFor("genre-breakdown")}
          onOpenItem={onOpenItem}
        />
      ),
    });

    list.push({
      key: "recent-genres",
      title: t("Recent Taste (30 Days)"),
      icon: "trending-up-outline",
      accent: colors.success,
      minTier: analysisCardMinTier("recent-genres"),
      render: (active) => (
        <RecentTasteBody
          stats={stats}
          bgLuminance={bgLuminance}
          active={active}
          initialSelection={selectionFor("recent-genres")}
          onSelectionChange={selectFor("recent-genres")}
          onOpenItem={onOpenItem}
        />
      ),
    });

    list.push({
      key: "favorite-genres",
      title: t("Favorite Genres"),
      icon: "heart-outline",
      accent: colors.secondary,
      minTier: analysisCardMinTier("favorite-genres"),
      render: (active) => (
        <FavoriteGenresBody
          stats={stats}
          bgLuminance={bgLuminance}
          active={active}
          initialSelection={selectionFor("favorite-genres")}
          onSelectionChange={selectFor("favorite-genres")}
          onOpenItem={onOpenItem}
        />
      ),
    });

    // `?? 0` / `?? []` throughout: these fields arrived in several separate
    // passes, so a history row saved before a given pass genuinely lacks
    // that field rather than carrying an empty value for it.
    const totalRatings = stats.totalRatings ?? stats.movies.watchedCount + stats.series.watchedCount;
    const totalFavorites = stats.favoriteGenres?.totalFavorites ?? 0;
    const memberSince = stats.memberSince
      ? new Date(stats.memberSince).toLocaleDateString(i18n.language, { month: "short", year: "numeric" })
      : null;
    // Paired two-per-row in this exact order, and deliberately without
    // followers/following: those are running totals with no time dimension,
    // which is the monthly card's job instead.
    const tiles: StatTileDef[] = [
      { icon: "checkmark-done-outline", label: t("Total Ratings"), value: String(totalRatings), countTo: totalRatings },
      { icon: "heart-outline", label: t("Favorites"), value: String(totalFavorites), countTo: totalFavorites },
      {
        icon: "film-outline",
        label: t("Movies Watched"),
        value: String(stats.movies.watchedCount),
        countTo: stats.movies.watchedCount,
      },
      {
        icon: "tv-outline",
        label: t("Series Watched"),
        value: String(stats.series.watchedCount),
        countTo: stats.series.watchedCount,
      },
      {
        icon: "star-outline",
        label: t("Avg Movie Rating"),
        // 5-star scale, matching every other rating display in the app
        // (utils/rating.ts) even though Rating.value is stored 1-10.
        value: stats.movies.avgRating ? `${formatFiveScale(stats.movies.avgRating)}/5` : "—",
        ...(stats.movies.avgRating ? { countTo: stats.movies.avgRating / 2, decimals: 1, suffix: "/5" } : {}),
      },
      {
        icon: "star-half-outline",
        label: t("Avg Series Rating"),
        value: stats.series.avgRating ? `${formatFiveScale(stats.series.avgRating)}/5` : "—",
        ...(stats.series.avgRating ? { countTo: stats.series.avgRating / 2, decimals: 1, suffix: "/5" } : {}),
      },
      { icon: "bookmark-outline", label: t("Watchlist"), value: String(stats.watchlist), countTo: stats.watchlist },
      {
        icon: "chatbubble-ellipses-outline",
        label: t("Reviews"),
        value: String(stats.social.reviewsCount),
        countTo: stats.social.reviewsCount,
      },
      {
        icon: "share-social-outline",
        label: t("Shares"),
        value: String(stats.social.shareCount ?? 0),
        countTo: stats.social.shareCount ?? 0,
      },
      ...(memberSince
        ? [{ icon: "calendar-outline" as const, label: t("Member Since"), value: memberSince }]
        : []),
    ];

    list.push({
      key: "stats",
      title: t("Your All Time Stats"),
      icon: "stats-chart-outline",
      accent: colors.info,
      minTier: analysisCardMinTier("stats"),
      render: (active) => <AnalysisStatsGrid tiles={tiles} active={active} />,
    });

    if (stats.monthlyStats) {
      list.push({
        key: "monthly-stats",
        title: t("Your Monthly Stats"),
        icon: "calendar-number-outline",
        accent: colors.success,
        minTier: analysisCardMinTier("monthly-stats"),
        render: (active) => <MonthlyStatsBody stats={stats} active={active} />,
      });
    }

    // Tier-gated tail of the deck. The server only computes ratingCurve /
    // activityTimeline for tiers whose config allows them, so their presence
    // IS the entitlement — no tier string to second-guess client-side, and a
    // Premium analysis shared into a chat keeps its extra cards for whoever
    // opens it.
    if (stats.ratingCurve || stats.activityTimeline) {
      if (stats.ratingCurve) {
        list.push({
          key: "rating-curve",
          title: t("Rating Curve"),
          icon: "analytics-outline",
          accent: colors.warning,
          minTier: analysisCardMinTier("rating-curve"),
          render: (active) => (
            <RatingCurveBody
              stats={stats}
              active={active}
              initialSelection={selectionFor("rating-curve")}
              onSelectionChange={selectFor("rating-curve")}
              onOpenItem={onOpenItem}
            />
          ),
        });
      }
      if (stats.activityTimeline) {
        list.push({
          key: "activity-timeline",
          title: t("Watch Timeline"),
          icon: "calendar-outline",
          accent: colors.info,
          minTier: analysisCardMinTier("activity-timeline"),
          render: (active) => (
            <ActivityTimelineBody
              stats={stats}
              active={active}
              initialSelection={selectionFor("activity-timeline")}
              onSelectionChange={selectFor("activity-timeline")}
              onOpenItem={onOpenItem}
            />
          ),
        });
      }
    } else {
      list.push({
        key: "premium-tease",
        title: t("Premium"),
        icon: "lock-closed-outline",
        accent: colors.warning,
        minTier: analysisCardMinTier("premium-tease"),
        render: () => <PremiumTeaseBody onUpgrade={onUpgrade} />,
      });
    }

    return list.filter((card) => tierAllows(viewerTier, card.minTier));
  }, [data, stats, colors, bgLuminance, t, i18n.language, onUpgrade, onOpenItem, selectionFor, selectFor, viewerTier]);

  // Wired to onMomentumScrollEnd *and* onScrollEndDrag: a slow drag released
  // exactly on a snap point carries no residual momentum, so iOS/Android
  // never fire the momentum event for it. Relying on that alone would leave
  // activeIndex stale — and since every card's entrance animation is gated
  // on being reached, a card arrived at that way would sit there blank
  // (bars at zero width, donut at zero stroke) instead of animating in.
  const onScrollSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    setActiveIndex((prev) => (prev === index ? prev : index));
  };

  const goToCard = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * (cardWidth + CARD_GAP), animated: true });
    setActiveIndex(index);
  };

  // Restore scroll position on mount when returning from a title's page —
  // un-animated, so it reads as "the modal was still open behind that
  // screen" rather than as a fresh deck scrolling itself into place.
  useEffect(() => {
    const restoreTo = stateRef?.current.activeIndex ?? 0;
    if (restoreTo > 0) {
      scrollRef.current?.scrollTo({ x: restoreTo * (cardWidth + CARD_GAP), animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = cards[activeIndex]?.key;
    if (!key) return;
    setRevealedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, [activeIndex, cards]);

  return (
    <View style={styles.wrap}>
      {/* Animated.ScrollView, not a plain one: Animated.event returns an
          AnimatedEvent object, not a callable, and only an
          Animated.createAnimatedComponent-wrapped component knows to attach
          it natively. A plain ScrollView would forward that object as the
          literal onScroll prop and call it — an "Object is not a function"
          crash on every scroll frame. */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
        contentContainerStyle={{ gap: CARD_GAP }}
      >
        {cards.map((card) => (
          <View key={card.key} style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            {card.key !== "ai-summary" && (
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${card.accent}22` }]}>
                  <Ionicons name={card.icon} size={13} color={card.accent} />
                </View>
                <Text style={styles.sectionTitle}>{card.title.toUpperCase()}</Text>
              </View>
            )}
            <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
              {card.render(revealedKeys.includes(card.key))}
            </ScrollView>
          </View>
        ))}
      </Animated.ScrollView>

      {cards.length > 1 && (
        <View style={styles.dotsRow}>
          {cards.map((card, i) => (
            <DeckDot
              key={card.key}
              scrollX={scrollX}
              index={i}
              pageWidth={cardWidth + CARD_GAP}
              onPress={() => goToCard(i)}
              styles={styles}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { gap: 14 },
    card: { backgroundColor: colors.base200, borderRadius: 16, padding: 16 },
    cardScroll: { flex: 1 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    cardIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.placeholder, letterSpacing: 0.4 },
    eyebrow: {
      color: colors.placeholder,
      opacity: 0.85,
      fontSize: 11,
      fontFamily: fonts.bold,
      letterSpacing: 1,
      marginBottom: 6,
    },
    tasteChip: {
      alignSelf: "flex-start",
      backgroundColor: colors.base300,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginTop: 6,
      marginBottom: 10,
    },
    tasteChipText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
    paragraph: { color: colors.baseContent, fontSize: 14, lineHeight: 20 },
    subsection: { marginTop: 14 },
    sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.placeholder, marginBottom: 6 },
    funFactBox: { backgroundColor: colors.base300, borderRadius: 10, padding: 14, marginTop: 14 },
    funFactText: { color: colors.baseContent, fontSize: 13, lineHeight: 19, fontStyle: "italic" },
    cardSubtitle: { color: colors.placeholder, fontSize: 12, marginBottom: 12 },
    // The "here's proof it's real" line — a tinted block rather than plain
    // text, so it reads as evidence attached to the chart above it instead
    // of as another caption.
    groundingText: {
      color: colors.baseContent,
      fontSize: 12.5,
      lineHeight: 18,
      backgroundColor: colors.base300,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      textAlign: "center",
    },
    donutRow: { alignItems: "center", justifyContent: "center", marginBottom: 12 },
    // Overlaid on the donut rather than passed into it, so the label can
    // cross-fade on selection independently of the ring's own entrance.
    donutCenterOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    donutCenterValue: { fontFamily: fonts.bold, fontSize: 27, color: colors.baseContent },
    // maxWidth ≈ the ring's inner hole, so a long genre name wraps inside it
    // instead of spilling out over the arcs.
    donutCenterLabel: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.placeholder,
      marginTop: 2,
      textAlign: "center",
      maxWidth: 104,
    },
    legendWrap: { gap: 2 },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    legendRowSelected: { backgroundColor: colors.base300 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { flex: 1, color: colors.baseContent, fontSize: 12.5, fontFamily: fonts.medium },
    legendLabelSelected: { fontFamily: fonts.bold, color: colors.primary },
    legendLabelMuted: { color: colors.placeholder },
    legendCount: { color: colors.placeholder, fontSize: 11 },
    legendPercent: { color: colors.baseContent, fontSize: 12, fontFamily: fonts.bold, width: 34, textAlign: "right" },
    // The Favorite Genres card's own "Other" line — matches AnalysisGenreBars'
    // row metrics so it reads as one more bar rather than a different widget.
    otherRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingHorizontal: 6 },
    otherLabel: { color: colors.placeholder, fontSize: 12, width: 74 },
    otherTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.base300, overflow: "hidden" },
    otherFill: { height: "100%", borderRadius: 4, backgroundColor: colors.border },
    otherValue: { color: colors.placeholder, fontSize: 11, width: 30, textAlign: "right" },
    hintText: { color: colors.placeholder, fontSize: 10.5, fontStyle: "italic", textAlign: "center", marginTop: 10 },
    insightBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.base300,
      borderRadius: 10,
      padding: 12,
      marginTop: 6,
    },
    insightText: { flex: 1, color: colors.baseContent, fontSize: 12.5, lineHeight: 18 },
    posterSection: { marginTop: 16 },
    posterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    // flexShrink so a long localized label can never push the "See all"
    // control off the edge of the card.
    posterHeaderLabel: { flexShrink: 1 },
    seeAll: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginBottom: 6 },
    footnote: {
      color: colors.placeholder,
      fontSize: 10.5,
      lineHeight: 15,
      textAlign: "center",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    emptyText: { color: colors.placeholder, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 20 },
    lockedWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: 24, gap: 10 },
    lockedIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.base300,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    lockedTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent, textAlign: "center" },
    lockedText: { fontSize: 13, color: colors.placeholder, textAlign: "center", lineHeight: 19 },
    lockedButton: {
      marginTop: 10,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    lockedButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
    dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
    // Fixed-width slot holding both states stacked on top of each other, so
    // the row's layout never changes as the active dot moves — the old
    // "active dot is wider" approach reflowed the whole row on every page
    // change, on the JS thread, at exactly the moment of the transition.
    dotSlot: { width: 16, height: 6, alignItems: "center", justifyContent: "center" },
    dotIdle: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActivePill: { position: "absolute", width: 16, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  });
}
