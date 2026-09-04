import { useEffect, useMemo, useState } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getRecentSharedActivity } from "../../api/matchService";
import type { LightweightContent } from "../../api/contentService";
import { formatFiveScale } from "../../utils/rating";
import PosterCoverflow from "./PosterCoverflow";
import LockedUnlockNote from "./LockedUnlockNote";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { categoryMeta } from "./matchCategoryMeta";
import type { SyncCandidate } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Same reserve/detail sizing as MatchSharedFavorites.tsx's own poster
// detail — one title line, one rating row, matched for the same reason
// (this panel's cards read as one consistent "focused poster detail"
// design, not a different scale per card).
const DETAIL_RESERVE_HEIGHT = 104;

interface Props {
  candidate: SyncCandidate;
  // False until the viewer has scrolled past the deck's own summary card —
  // see MatchAnalysisPanel.tsx's shouldLoadExtras for why: this card's own
  // fetch used to fire the instant a candidate was selected, one of up to 8
  // parallel requests regardless of whether this specific card was ever
  // scrolled to.
  shouldLoad: boolean;
  // Plus tier — half the posters (rounded up) are hidden behind
  // LockedUnlockNote instead of the full feed. Free never reaches this card
  // at all (MatchAnalysisPanel's own 3-card deck), Premium/dev leave this
  // false.
  locked?: boolean;
}

// "Activity" made visible as actual titles, not a score — the real overlap
// computeMatchBreakdown's own trendingAlignment sub-score is a Jaccard
// ratio *of* (both sides' recently-rated content, intersected), surfaced
// here as an actual poster feed via a new endpoint (getRecentSharedActivity)
// built for this card specifically — deliberately a 30-day window, not the
// 90-day RATING_RECENCY_WINDOW_MS the real score itself still uses, so this
// card's own "lately" reads as recent without changing anything about the
// actual match percentage.
export default function MatchActivityFeed({ candidate, shouldLoad, locked }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<LightweightContent[] | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Reset on candidate switch — independent of shouldLoad, which resets to
  // false on every switch too (MatchAnalysisPanel.tsx's own activeIndex
  // reset), but keeping this explicit rather than relying on that
  // indirection means a stale previous candidate's items can never survive
  // a switch even if shouldLoad somehow stayed true across it.
  useEffect(() => {
    setItems(null);
  }, [candidate.user._id]);

  // Gated on shouldLoad, and on `items === null` — the latter is what
  // prevents a redundant re-fetch every time shouldLoad flips (true while
  // scrolled near this card, false while scrolled away, back to true on a
  // return visit): once a real result has landed for the current
  // candidate, this effect becomes a no-op until the candidate actually
  // changes (which clears items back to null above).
  useEffect(() => {
    if (!shouldLoad || items !== null) return;
    let cancelled = false;
    getRecentSharedActivity(candidate.user._id, candidate.contentType)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, candidate.contentType, shouldLoad]);

  // A fresh item list (a different candidate, or the fetch just landed)
  // resets focus to "nothing yet" — matches Shared Genres/Shared
  // Favorites' own convention now: PosterCoverflow rests on its own
  // leading empty slot (leadingEmptySlot below) rather than auto-focusing
  // item 0, so every poster-scrolling card in this deck starts the same
  // way. PosterCoverflow's own mount effect reports this same null right
  // back via onFocusChange once it renders; this just avoids a stale
  // previous candidate's id briefly showing first.
  useEffect(() => {
    setFocusedId(null);
  }, [items]);

  const { opacity: detailOpacity, translateY: detailTranslateY } = useRevealAnimation(focusedId, 360, 8);
  const { opacity: hintOpacity } = useRevealAnimation(focusedId ? null : "shown", 360);

  const focusedItem = focusedId ? items?.find((i) => i._id === focusedId) ?? null : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        desc: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18, marginBottom: 16, textAlign: "center" },
        emptyText: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18, textAlign: "center" },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 12, marginBottom: 10 },
        reserve: { height: DETAIL_RESERVE_HEIGHT, position: "relative" },
        hintWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
        hint: { fontSize: 11, fontStyle: "italic", color: colors.placeholder, textAlign: "center", lineHeight: 16 },
        detailWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 10 },
        title: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, textAlign: "center" },
        ratingsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 24 },
        ratingColumn: { alignItems: "center", gap: 8, maxWidth: "45%" },
        ratingName: { fontFamily: fonts.bold, fontSize: 14, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5 },
        ratingUnit: { flexDirection: "row", alignItems: "center", gap: 6 },
        ratingText: { fontSize: 15, fontFamily: fonts.medium, color: colors.baseContent },
        ratingMuted: { fontSize: 11.5, fontStyle: "italic", color: colors.placeholder },
      }),
    [colors]
  );

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <View>
        <Text style={styles.desc}>{categoryMeta("bonus", colors, t).desc}</Text>
        <Text style={styles.emptyText}>{t("Nothing you've both rated in the last 30 days yet.")}</Text>
      </View>
    );
  }

  // Plus tier — half the posters (rounded up, so 1 item stays visible
  // rather than locking everything) hidden behind LockedUnlockNote.
  const visibleItems = locked ? items.slice(0, Math.max(1, Math.ceil(items.length / 2))) : items;
  const hiddenCount = items.length - visibleItems.length;

  return (
    <View>
      <Text style={styles.desc}>{categoryMeta("bonus", colors, t).desc}</Text>

      {/* Always the coverflow now, regardless of item count — the tap-based
          PosterRow fallback used to kick in below a minimum item count,
          but per direct ask the scroll interaction should behave
          identically no matter how few posters there are.
          leadingEmptySlot matches Shared Genres/Shared Favorites, per
          direct ask that this card start the same way as the others
          (nothing focused at rest) rather than jumping straight to item
          0's detail with no equivalent idle state. */}
      <PosterCoverflow items={visibleItems} onFocusChange={setFocusedId} leadingEmptySlot />
      {hiddenCount > 0 && <LockedUnlockNote label={t("Showing {{shown}} of {{total}}", { shown: visibleItems.length, total: items.length })} />}

      <View style={styles.divider} />

      <View style={styles.reserve}>
        <Animated.View style={[styles.hintWrap, { opacity: hintOpacity }]} pointerEvents="none">
          <Text style={styles.hint}>{t("Swipe or tap a poster to see how you both rated it.")}</Text>
        </Animated.View>

        {focusedId && focusedItem && (
          <Animated.View style={[styles.detailWrap, { opacity: detailOpacity, transform: [{ translateY: detailTranslateY }] }]}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {focusedItem.title ?? focusedItem.name ?? ""}
            </Text>
            <View style={styles.ratingsRow}>
              <View style={styles.ratingColumn}>
                <Text style={styles.ratingName} numberOfLines={1} ellipsizeMode="tail">
                  {t("You")}
                </Text>
                {focusedItem.myRating != null ? (
                  <View style={styles.ratingUnit}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{formatFiveScale(focusedItem.myRating)}</Text>
                  </View>
                ) : (
                  <Text style={styles.ratingMuted}>{t("Not rated yet")}</Text>
                )}
              </View>
              <View style={styles.ratingColumn}>
                <Text style={styles.ratingName} numberOfLines={1} ellipsizeMode="tail">
                  {candidate.user.username}
                </Text>
                {focusedItem.targetRating != null ? (
                  <View style={styles.ratingUnit}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{formatFiveScale(focusedItem.targetRating)}</Text>
                  </View>
                ) : (
                  <Text style={styles.ratingMuted}>{t("Not rated yet")}</Text>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
