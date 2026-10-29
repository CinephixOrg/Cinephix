import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getPopularReviews } from "../../api/reviewService";
import SearchReviewCard from "./SearchReviewCard";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Fills Search's Reviews tab empty state — direct correction: this isn't a
// poster browse of the viewer's own watched titles (that's what the
// Movies/Series tab's SuggestedForYouGrid already is) — it's actual
// popular REVIEWS written about those titles ("userın watchedlistinde
// bulunan film ya da dizilere yazılmış popüler reviewlar"), via
// reviewController.js's getPopularReviews with its new `watchedOnly` flag
// (filters server-side to the viewer's own watchlist content ids, reusing
// the exact same sort/hydration the tab's real search results already go
// through — no separate aggregation to maintain).
export default function SuggestedReviewsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<PopularReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPopularReviews(1, 3, undefined, undefined, "liked", null, null, true)
      .then((res) => {
        if (!cancelled) setReviews(res.items);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", paddingTop: 16 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 4, paddingHorizontal: 20 },
      }),
    [colors]
  );

  if (!reviews || reviews.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("You might be interested")}</Text>
      {reviews.map((review) => (
        <SearchReviewCard key={review._id} review={review} basePath="/search" />
      ))}
    </View>
  );
}
