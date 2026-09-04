import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getMoviesBulk, getSeriesBulk, type LightweightContent } from "../../api/contentService";
import { getContentRatings } from "../../api/matchService";
import { MOVIE_GENRE_OPTIONS, SERIES_GENRE_OPTIONS } from "../../constants/contentGenreIds";
import { formatFiveScale } from "../../utils/rating";
import type { PosterBadge } from "./PosterRow";
import PosterCoverflow from "./PosterCoverflow";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import type { ContentType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  targetUserId: string;
  contentType: ContentType;
  sharedIds: string[];
  genreOnlyMineIds: string[];
  genreOnlyTheirsIds: string[];
  targetUsername: string;
  // False until the viewer has scrolled past the deck's own summary card —
  // see MatchAnalysisPanel.tsx's shouldLoadExtras. This card fires two
  // fetches (bulk content lookup + ratings) that used to both start the
  // instant a candidate was selected, regardless of whether this card was
  // ever actually scrolled to.
  shouldLoad: boolean;
}

type MatchKind = "exact" | "mine" | "theirs";
type RatingPair = { myRating?: number; targetRating?: number };

// Single reserved slot below the poster row — a hint (nothing selected yet,
// only possible in the <3-item tap-based fallback) or the focused poster's
// title + (for genre-only matches) shared-genre tag + two-column rating row,
// cross-fading in place. Sized against the real worst case: one title line,
// one tag line, one rating row — taller than this card used to reserve,
// to fit the detail text now sized to match Shared Genres' own scale.
const DETAIL_RESERVE_HEIGHT = 104;

export default function MatchSharedFavorites({
  targetUserId,
  contentType,
  sharedIds,
  genreOnlyMineIds,
  genreOnlyTheirsIds,
  targetUsername,
  shouldLoad,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [itemsById, setItemsById] = useState<Map<string, LightweightContent>>(new Map());
  const [ratingsById, setRatingsById] = useState<Map<string, RatingPair>>(new Map());
  // Driven by a tap in the <3-item fallback row, or by scroll position in the
  // 3+-item coverflow — either way, "the poster whose detail is showing below".
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Which "contentType:allIds" key each fetch below has *successfully
  // completed* for — set only inside the .then(), never before starting
  // the request. A real, live bug came from an earlier version that set
  // this eagerly (right before firing the request): a candidate switch
  // while activeIndex was already >=1 from browsing a *previous* candidate
  // starts shouldLoad already true, fires the fetch, marks the ref — then
  // MatchAnalysisPanel's own reset-activeIndex-to-0 effect flips shouldLoad
  // back to false a moment later, which cancels the in-flight request via
  // this effect's own cleanup. With the ref already marked, every later
  // shouldLoad:true (the user swiping past the summary again) saw
  // "already handled" and skipped fetching forever — itemsById/ratingsById
  // stayed permanently empty for that candidate, the card rendering as a
  // blank `return null` with no way to recover short of leaving and
  // reselecting. Marking success-only means a cancelled attempt leaves the
  // ref untouched, so the next shouldLoad:true genuinely retries.
  const itemsFetchKeyRef = useRef<string | null>(null);
  const ratingsFetchKeyRef = useRef<string | null>(null);

  const allIds = [...new Set([...sharedIds, ...genreOnlyMineIds, ...genreOnlyTheirsIds])];
  const allIdsKey = allIds.join(",");

  // Reset on candidate switch, independent of shouldLoad — see
  // MatchActivityFeed.tsx's own identical comment for why this stays a
  // separate effect rather than relying on shouldLoad's own reset.
  useEffect(() => {
    setItemsById(new Map());
    setRatingsById(new Map());
    itemsFetchKeyRef.current = null;
    ratingsFetchKeyRef.current = null;
  }, [targetUserId]);

  useEffect(() => {
    if (allIds.length === 0) {
      setItemsById(new Map());
      return;
    }
    const key = `${contentType}:${allIdsKey}`;
    if (!shouldLoad || itemsFetchKeyRef.current === key) return;
    let cancelled = false;
    (contentType === "movie" ? getMoviesBulk(allIds) : getSeriesBulk(allIds))
      .then((res) => {
        if (cancelled) return;
        itemsFetchKeyRef.current = key;
        setItemsById(new Map(res.map((item) => [item._id, item])));
      })
      .catch(() => {
        if (!cancelled) setItemsById(new Map());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, allIdsKey, shouldLoad]);

  useEffect(() => {
    if (allIds.length === 0) {
      setRatingsById(new Map());
      return;
    }
    const key = `${contentType}:${allIdsKey}`;
    if (!shouldLoad || ratingsFetchKeyRef.current === key) return;
    let cancelled = false;
    getContentRatings(targetUserId, contentType, allIds)
      .then((res) => {
        if (cancelled) return;
        ratingsFetchKeyRef.current = key;
        setRatingsById(new Map(Object.entries(res)));
      })
      .catch(() => {
        if (!cancelled) setRatingsById(new Map());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, contentType, allIdsKey, shouldLoad]);

  const kindById = useMemo(() => {
    const map = new Map<string, MatchKind>();
    sharedIds.forEach((id) => map.set(id, "exact"));
    genreOnlyMineIds.forEach((id) => map.set(id, "mine"));
    genreOnlyTheirsIds.forEach((id) => map.set(id, "theirs"));
    return map;
  }, [sharedIds, genreOnlyMineIds, genreOnlyTheirsIds]);

  const genreNameById = useMemo(() => {
    const options = contentType === "movie" ? MOVIE_GENRE_OPTIONS : SERIES_GENRE_OPTIONS;
    return new Map(options.map((g) => [g.id, g.name]));
  }, [contentType]);

  const resolve = (ids: string[]) => ids.map((id) => itemsById.get(id)).filter((item): item is LightweightContent => !!item);
  const orderedItems = [...resolve(sharedIds), ...resolve(genreOnlyMineIds), ...resolve(genreOnlyTheirsIds)];

  // A fresh candidate/filter (different id-list identity, or itemsById just
  // finished loading for the current one) resets focus to "nothing yet" —
  // both branches now start there: the coverflow rests on its own leading
  // empty slot (PosterCoverflow's leadingEmptySlot), the fallback tap row
  // was already starting unfocused. PosterCoverflow's own mount effect
  // reports this same null right back via onFocusChange once it renders,
  // this just avoids a stale previous candidate's id briefly showing first.
  useEffect(() => {
    setFocusedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedIds.join(","), genreOnlyMineIds.join(","), genreOnlyTheirsIds.join(","), itemsById]);

  // Single reveal for the whole detail block — unlike MatchAnalysisPanel's
  // own poster detail (where the "You"/{username} labels are literally the
  // same text across every switch, only the values below them change), every
  // piece of content here — title, tag, ratings — is different content on
  // every focus change, so there's no "stays put" sub-piece to freeze after
  // the first reveal; everything replays together.
  const { opacity: detailOpacity, translateY: detailTranslateY } = useRevealAnimation(focusedId, 360, 8);
  const { opacity: hintOpacity } = useRevealAnimation(focusedId ? null : "shown", 360);

  const detailPartsFor = (id: string) => {
    const kind = kindById.get(id);
    const item = itemsById.get(id);
    if (!kind || !item) return null;

    let tag: string | null = null;
    if (kind !== "exact") {
      // Mirrors matchController.js's buildMatchInsights genre-only derivation
      // — re-expressed over already-fetched item data instead of a new
      // endpoint: which genre(s) does this item share with the OTHER side's
      // non-exact picks.
      const otherIds = kind === "mine" ? genreOnlyTheirsIds : genreOnlyMineIds;
      const otherGenreSet = new Set(otherIds.flatMap((oid) => itemsById.get(oid)?.genre_ids ?? []));
      const matchedNames = (item.genre_ids ?? [])
        .filter((g) => otherGenreSet.has(g))
        .map((g) => genreNameById.get(g))
        .filter((name): name is string => !!name)
        .slice(0, 2);
      const genreLabel = matchedNames.length > 0 ? matchedNames.join(", ") : t("a shared genre");
      tag = t("Shared genre: {{genre}}", { genre: genreLabel });
    }

    const rating = ratingsById.get(id) ?? {};
    return {
      title: item.title ?? item.name ?? "",
      tag,
      myRating: rating.myRating,
      targetRating: rating.targetRating,
    };
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 12, marginBottom: 10 },
        reserve: { height: DETAIL_RESERVE_HEIGHT, position: "relative" },
        hintWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
        hint: { fontSize: 11, fontStyle: "italic", color: colors.placeholder, textAlign: "center", lineHeight: 16 },
        // Sizing/spacing matched to MatchAnalysisPanel's own Shared Genres
        // poster detail (posterDetail/posterDetailTitle/ratingName/ratingText)
        // rather than this card's own smaller original scale — per direct
        // feedback that the two should read as the same "focused poster
        // detail" design. `gap` on this column (not per-child margins) does
        // the title→tag→ratingsRow spacing, matching that file's approach.
        detailWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 10 },
        title: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, textAlign: "center" },
        tag: { fontSize: 11, color: colors.primary, textAlign: "center" },
        ratingsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 24 },
        ratingColumn: { alignItems: "center", gap: 8, maxWidth: "45%" },
        ratingName: { fontFamily: fonts.bold, fontSize: 14, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5 },
        ratingUnit: { flexDirection: "row", alignItems: "center", gap: 6 },
        ratingText: { fontSize: 15, fontFamily: fonts.medium, color: colors.baseContent },
        ratingMuted: { fontSize: 11.5, fontStyle: "italic", color: colors.placeholder },
        // Small always-visible key for the two poster badges above — added
        // per direct feedback that what "=" vs. the tag icon actually means
        // wasn't obvious on its own. Two rows, badge stacked above its own
        // one-line explanation (not side by side), kept compact enough to
        // fit under the card's own reserved detail area without pushing the
        // card's overall height up much.
        legend: { gap: 8 },
        legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        legendBadge: {
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.base100,
          alignItems: "center",
          justifyContent: "center",
        },
        legendChar: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15 },
        legendText: { flex: 1, fontSize: 10.5, color: colors.placeholder, lineHeight: 14 },
      }),
    [colors]
  );

  if (orderedItems.length === 0) return null;

  // "=" (not a checkmark) for an exact title match — reads more directly as
  // "the same thing", per direct feedback that the two badge meanings
  // weren't obvious; the legend below the card spells both out anyway.
  const badgeFor = (item: LightweightContent): PosterBadge | null => {
    const kind = kindById.get(item._id);
    if (kind === "exact") return { char: "=", color: colors.success };
    if (kind === "mine" || kind === "theirs") return { icon: "pricetag" as const, color: colors.primary };
    return null;
  };

  const focusedDetail = focusedId ? detailPartsFor(focusedId) : null;

  return (
    <View>
      {/* Always the coverflow now, regardless of item count (even a single
          poster) — the tap-based PosterRow fallback used to kick in below
          COVERFLOW_MIN_ITEMS, but per direct ask the scroll interaction
          should behave identically no matter how few posters there are,
          not switch to a different (tap-only) mechanism. */}
      <PosterCoverflow items={orderedItems} badgeFor={badgeFor} onFocusChange={setFocusedId} leadingEmptySlot />

      <View style={styles.divider} />

      <View style={styles.reserve}>
        {/* Shown whenever nothing's focused, not just in the tap-based
            fallback — the coverflow now rests on its own leading empty
            slot the same way (PosterCoverflow's leadingEmptySlot), so it
            needs the same "here's what to do" hint instead of jumping
            straight into a poster's detail with no equivalent idle state. */}
        {!focusedId && (
          <Animated.View style={[styles.hintWrap, { opacity: hintOpacity }]} pointerEvents="none">
            <Text style={styles.hint}>{t("Swipe or tap a poster to see how it matched.")}</Text>
          </Animated.View>
        )}

        {focusedId && focusedDetail && (
          <Animated.View style={[styles.detailWrap, { opacity: detailOpacity, transform: [{ translateY: detailTranslateY }] }]}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {focusedDetail.title}
            </Text>
            {focusedDetail.tag && (
              <Text style={styles.tag} numberOfLines={1} ellipsizeMode="tail">
                {focusedDetail.tag}
              </Text>
            )}
            <View style={styles.ratingsRow}>
              <View style={styles.ratingColumn}>
                <Text style={styles.ratingName} numberOfLines={1} ellipsizeMode="tail">
                  {t("You")}
                </Text>
                {focusedDetail.myRating != null ? (
                  <View style={styles.ratingUnit}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{formatFiveScale(focusedDetail.myRating)}</Text>
                  </View>
                ) : (
                  <Text style={styles.ratingMuted}>{t("Not rated yet")}</Text>
                )}
              </View>
              <View style={styles.ratingColumn}>
                <Text style={styles.ratingName} numberOfLines={1} ellipsizeMode="tail">
                  {targetUsername}
                </Text>
                {focusedDetail.targetRating != null ? (
                  <View style={styles.ratingUnit}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{formatFiveScale(focusedDetail.targetRating)}</Text>
                  </View>
                ) : (
                  <Text style={styles.ratingMuted}>{t("Not rated yet")}</Text>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Same divider as above, between the poster row and this detail
          block — the detail block's own content is already centered within
          `reserve`'s fixed height, so sandwiching it between two identical
          dividers puts it exactly in the middle of the two lines, not just
          vertically centered within an otherwise-unbounded area. */}
      <View style={styles.divider} />

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={styles.legendBadge}>
            <Text style={[styles.legendChar, { color: colors.success }]}>=</Text>
          </View>
          <Text style={styles.legendText}>{t("Same title in both your favorites")}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendBadge}>
            <Ionicons name="pricetag" size={12} color={colors.primary} />
          </View>
          <Text style={styles.legendText}>{t("Different title, shares a genre with one of your favorites")}</Text>
        </View>
      </View>
    </View>
  );
}
