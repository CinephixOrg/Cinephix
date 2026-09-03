import { useEffect, useMemo, useState } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getRecentSharedActivity } from "../../api/matchService";
import type { LightweightContent } from "../../api/contentService";
import { formatFiveScale } from "../../utils/rating";
import PosterRow from "./PosterRow";
import PosterCoverflow, { COVERFLOW_MIN_ITEMS } from "./PosterCoverflow";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { categoryMeta } from "./matchCategoryMeta";
import type { SwipeCandidate } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Same reserve/detail sizing as MatchSharedFavorites.tsx's own poster
// detail — one title line, one rating row, matched for the same reason
// (this panel's cards read as one consistent "focused poster detail"
// design, not a different scale per card).
const DETAIL_RESERVE_HEIGHT = 104;

interface Props {
  candidate: SwipeCandidate;
}

// "Activity" made visible as actual titles, not a score — the real overlap
// computeMatchBreakdown's own trendingAlignment sub-score is a Jaccard
// ratio *of* (both sides' recently-rated content, intersected), surfaced
// here as an actual poster feed via a new endpoint (getRecentSharedActivity)
// built for this card specifically — deliberately a 30-day window, not the
// 90-day RATING_RECENCY_WINDOW_MS the real score itself still uses, so this
// card's own "lately" reads as recent without changing anything about the
// actual match percentage.
export default function MatchActivityFeed({ candidate }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<LightweightContent[] | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
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
  }, [candidate.user._id, candidate.contentType]);

  const useCoverflow = (items?.length ?? 0) >= COVERFLOW_MIN_ITEMS;

  // A fresh item list (a different candidate, or the fetch just landed)
  // resets focus — same rule MatchSharedFavorites.tsx uses: the coverflow
  // branch always has a real focus (index 0, matching its scroll position
  // at rest), the fallback tap row starts at "nothing tapped yet".
  useEffect(() => {
    if (!items) return;
    setFocusedId(items.length >= COVERFLOW_MIN_ITEMS ? items[0]._id : null);
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

  return (
    <View>
      <Text style={styles.desc}>{categoryMeta("bonus", colors, t).desc}</Text>

      {useCoverflow ? (
        <PosterCoverflow items={items} onFocusChange={setFocusedId} />
      ) : (
        <PosterRow items={items} selectedId={focusedId} onSelect={setFocusedId} />
      )}

      <View style={styles.divider} />

      <View style={styles.reserve}>
        {!useCoverflow && (
          <Animated.View style={[styles.hintWrap, { opacity: hintOpacity }]} pointerEvents="none">
            <Text style={styles.hint}>{t("Tap a poster to see how you both rated it.")}</Text>
          </Animated.View>
        )}

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
