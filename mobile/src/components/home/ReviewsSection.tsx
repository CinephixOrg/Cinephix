import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getPopularReviews, getReviewsFromFriends } from "../../api/reviewService";
import ReviewFeedCard from "../ReviewFeedCard";
import { SkeletonRail } from "../Skeleton";
import type { ContentType, PopularReview } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Reviews tab: an internal Film/Series segmented sub-tab (defaults to
// Film), each showing Popular Reviews and Reviews from Friends.
export default function ReviewsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    container: { flexGrow: 1 },
    body: { paddingHorizontal: 16, paddingTop: 16 },
    // Same underline style as the outer Films/Series/Reviews/Lists tab bar
    // (home/index.tsx) — the user asked for the two tab bars to match.
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.base200,
    },
    tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
    tabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
    tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 12 },
    empty: { color: colors.placeholder, fontSize: 13, marginBottom: 20 },
    error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  }), [colors]);

  const [subTab, setSubTab] = useState<ContentType>("movie");
  const [popular, setPopular] = useState<PopularReview[]>([]);
  const [fromFriends, setFromFriends] = useState<PopularReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [popularRes, friendsRes] = await Promise.all([
        getPopularReviews(10, subTab),
        getReviewsFromFriends(10, subTab),
      ]);
      setPopular(popularRes);
      setFromFriends(friendsRes);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load home."));
    }
  }, [subTab]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.base100 }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.tabBar}>
        {(["movie", "series"] as ContentType[]).map((type) => (
          <Pressable
            key={type}
            style={[styles.tabButton, subTab === type && styles.tabButtonActive]}
            onPress={() => setSubTab(type)}
          >
            <Text style={[styles.tabText, subTab === type && styles.tabTextActive]}>
              {type === "movie" ? t("Movies") : t("Series")}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <>
            <SkeletonRail />
            <SkeletonRail />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t("Popular Reviews")}</Text>
            {popular.length === 0 ? (
              <Text style={styles.empty}>{t("No reviews yet. Be the first!")}</Text>
            ) : (
              popular.map((review) => <ReviewFeedCard key={review._id} review={review} basePath="/home" />)
            )}

            <Text style={styles.sectionTitle}>{t("Reviews from Friends")}</Text>
            {fromFriends.length === 0 ? (
              <Text style={styles.empty}>{t("No friends have reviewed this yet.")}</Text>
            ) : (
              fromFriends.map((review) => <ReviewFeedCard key={review._id} review={review} basePath="/home" />)
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
