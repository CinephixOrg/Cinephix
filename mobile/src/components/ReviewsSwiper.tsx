import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Pressable from "./common/TapSafePressable";
// From react-native-gesture-handler, not react-native — this rail's own
// horizontal paging nests inside Discover's outer horizontal page-switcher
// (home/index.tsx), same reason every other horizontal scroller on this
// page uses it (see that file's own comment for the full story).
import { ScrollView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import ReviewSwipeCard, { POSTER_HEIGHT } from "./ReviewSwipeCard";
import type { PopularReview } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { useWithoutBlocked } from "../hooks/useBlocked";

const reviewAuthor = (review: PopularReview) => review.user?._id;

const SIDE_PADDING = 16;
const HINT_BOB_MS = 900;
const HINT_BOB_DISTANCE = 5;
// ReviewSwipeCard's own poster height plus its card padding (12 top+12
// bottom) — used only to vertically center the edge-hint arrows against
// roughly where the card sits, not to constrain the card's own height
// (that stays natural/flexible).
const CARD_HEIGHT_HINT = POSTER_HEIGHT + 24;

interface Props {
  reviews: PopularReview[];
  basePath: "/home" | "/search";
  onSeeAllPress?: () => void;
}

// Reviews as a real full-width, one-card-per-swipe pager again (reverted
// from a "~1.5 cards visible" snap-scroll — the user's own follow-up call)
// — same page-per-swipe + bobbing chevron-hint mechanism LeaderboardPodium
// already uses, reused rather than reinvented. Each page is
// ReviewSwipeCard.tsx: a real, readable review with its own poster-peek/
// Detail and expand-to-popup interactions (see that component's own doc
// comment). "See all" was removed a few rounds back, then reinstated —
// `/home/reviews` still exists and works, it was just unreachable in the
// meantime; this rail's own cap (10) stays the same either way.
export default function ReviewsSwiper({ reviews: allReviews, basePath, onSeeAllPress }: Props) {
  // Reviews by someone blocked just now vanish at once.
  const reviews = useWithoutBlocked(allReviews, reviewAuthor);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: HINT_BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: HINT_BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== page) setPage(next);
  };
  const goToPage = (index: number) => scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 24 },
        titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        seeAll: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
        empty: { color: colors.placeholder, fontSize: 13, paddingHorizontal: 16 },
        swiperWrap: { position: "relative" },
        page: { width: screenWidth, paddingHorizontal: SIDE_PADDING },
        arrowHintRight: { position: "absolute", right: 4, top: CARD_HEIGHT_HINT / 2 - 14 },
        arrowHintLeft: { position: "absolute", left: 4, top: CARD_HEIGHT_HINT / 2 - 14 },
        arrowCircle: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${colors.placeholder}29`,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, screenWidth]
  );

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("Popular Reviews")}</Text>
        {onSeeAllPress && (
          <Pressable onPress={onSeeAllPress} hitSlop={8}>
            <Text style={styles.seeAll}>{t("See all")}</Text>
          </Pressable>
        )}
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.empty}>{t("No reviews yet. Be the first!")}</Text>
      ) : (
        <View style={styles.swiperWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {reviews.map((review) => (
              <View key={review._id} style={styles.page}>
                <ReviewSwipeCard review={review} basePath={basePath} />
              </View>
            ))}
          </ScrollView>

          {page < reviews.length - 1 && (
            <Animated.View
              style={[styles.arrowHintRight, { transform: [{ translateX: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, HINT_BOB_DISTANCE] }) }] }]}
            >
              <Pressable style={styles.arrowCircle} onPress={() => goToPage(page + 1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={16} color={colors.baseContent} />
              </Pressable>
            </Animated.View>
          )}
          {page > 0 && (
            <Animated.View
              style={[styles.arrowHintLeft, { transform: [{ translateX: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -HINT_BOB_DISTANCE] }) }] }]}
            >
              <Pressable style={styles.arrowCircle} onPress={() => goToPage(page - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={16} color={colors.baseContent} />
              </Pressable>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}
