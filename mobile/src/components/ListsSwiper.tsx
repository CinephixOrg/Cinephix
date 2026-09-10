import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
// From react-native-gesture-handler, not react-native — this rail's own
// horizontal paging nests inside Discover's outer horizontal page-switcher
// (home/index.tsx), same reason ReviewsSwiper.tsx/LeaderboardPodium.tsx
// both already use it (see home/index.tsx's own comment for the full story).
import { ScrollView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import DiscoverListCard from "./DiscoverListCard";
import type { DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const SIDE_PADDING = 16;
const HINT_BOB_MS = 900;
const HINT_BOB_DISTANCE = 5;
// Rough vertical center for the edge-hint arrows — a list card's real
// height varies (description/film-strip both optional), this only needs to
// land roughly mid-card, not pixel-exact.
const CARD_HEIGHT_HINT = 180;

interface Props {
  lists: DiscoverListItem[];
  basePath: "/home";
  onSeeAllPress?: () => void;
}

// Discover's Lists preview, redone as the same real full-width, one-card-
// per-swipe pager ReviewsSwiper.tsx already is (was ListRailCard.tsx inside
// a horizontal ContentRail — several poster-forward cards visible side by
// side) — direct ask to match Reviews' own "one at a time, swipe sideways"
// feel instead. The card itself is DiscoverListCard.tsx — same design as
// the "See all" Lists page (ListsSection.tsx) uses, per direct correction
// ("posta benziyo, see alldaki gibi olsun" — an earlier pass here had used
// search/SearchListCard.tsx instead, a different, post-box-styled layout
// that wasn't what was actually asked for) — plus the like/view counts and
// Premium gold-frame both added to DiscoverListCard.tsx itself, so the
// "See all" page picks them up too, not just this preview.
// DiscoverListCard.tsx has no side margin of its own (its usual home,
// ListsSection.tsx, supplies that via its own ScrollView padding instead) —
// `page` below adds it directly since this pager's ScrollView doesn't.
export default function ListsSwiper({ lists, basePath, onSeeAllPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
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
        <Text style={styles.title}>{t("Popular Lists")}</Text>
        {onSeeAllPress && (
          <Pressable onPress={onSeeAllPress} hitSlop={8}>
            <Text style={styles.seeAll}>{t("See all")}</Text>
          </Pressable>
        )}
      </View>

      {lists.length === 0 ? (
        <Text style={styles.empty}>{t("No lists yet. Be the first!")}</Text>
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
            {lists.map((list) => (
              <View key={list._id} style={styles.page}>
                <DiscoverListCard list={list} basePath={basePath} onPress={() => router.push(`${basePath}/lists/${list._id}` as any)} />
              </View>
            ))}
          </ScrollView>

          {page < lists.length - 1 && (
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
