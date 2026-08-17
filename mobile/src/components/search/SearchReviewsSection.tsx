import { useCallback, useEffect, useState, useMemo } from "react";
import { ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getPopularReviews } from "../../api/reviewService";
import ReviewFeedCard from "../ReviewFeedCard";
import type { PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  query: string;
}

// Reviews tab of the Search page — same popularity-sorted default and card
// design as Home's Popular Reviews rail (ReviewFeedCard), now also
// title-searchable via the new `q` param on getPopularReviews.
export default function SearchReviewsSection({ query }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { padding: 16, flexGrow: 1 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [reviews, setReviews] = useState<PopularReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getPopularReviews(30, undefined, query || undefined);
      setReviews(result);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load reviews."));
    }
  }, [query]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.base100 }} color={colors.primary} />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {reviews.length === 0 ? (
        <Text style={styles.empty}>{t("No results found.")}</Text>
      ) : (
        reviews.map((review) => <ReviewFeedCard key={review._id} review={review} basePath="/search" />)
      )}
    </ScrollView>
  );
}
