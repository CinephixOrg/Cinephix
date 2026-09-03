import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  ActivityIndicator,
  Easing,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
// From react-native-gesture-handler, not react-native — this podium's own
// horizontal paging nests inside Discover's outer horizontal page-switcher
// (home/index.tsx); it needs gesture-handler's pan resolution to keep
// working, see that file's comment for why.
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import LeaderboardCard from "./LeaderboardCard";
import { getLeaderboard } from "../api/feedService";
import type { ContentType, LeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Only movie/series — a 3rd "both" mode was tried and dropped: with only
// 2 icons in the toggle, a state where neither reads as selected doesn't
// actually communicate "showing both", it just looks unset. Defaults to
// "movie" so the toggle always shows one concrete selected state, never an
// ambiguous starting one.
const MODE_CYCLE: ContentType[] = ["movie", "series"];

// Same bob-loop technique as MatchSummarySwiper.tsx's own scroll-hint chevron
// (Animated.loop + Animated.sequence, Easing.inOut(Easing.sin)) — reused
// horizontally here instead of vertically, so a "swipe for more" hint reads
// consistently across the app rather than inventing a second animation idiom.
const HINT_BOB_MS = 900;
const HINT_BOB_DISTANCE = 5;
// Tall enough for the biggest card (rank-1's bigger poster + platform line
// + name + a metric row) — a horizontal ScrollView's cross-axis doesn't
// reliably auto-size to its tallest child, same caution ContentRail.tsx's
// own optional `height` prop documents.
const PODIUM_HEIGHT = 220;
const PAGE_COUNT = 3;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  basePath: "/home" | "/search";
}

// Reorders a rank-1..3-sorted list into podium display order (2nd, 1st,
// 3rd) and returns the true rank alongside each — falls back to natural
// order for the (real but unlikely) case of fewer than 3 entries, so
// items[1]/items[2] are never accessed out of bounds.
function toPodiumOrder<T>(items: T[]): { item: T; rank: 1 | 2 | 3 }[] {
  if (items.length < 3) return items.map((item, i) => ({ item, rank: (i + 1) as 1 | 2 | 3 }));
  return [
    { item: items[1], rank: 2 as const },
    { item: items[0], rank: 1 as const },
    { item: items[2], rank: 3 as const },
  ];
}

// One podium, three pages (Most Favorited / Highest Rated / Most
// Recommended) — a real horizontal-paging ScrollView (genuinely swipeable,
// not just a tap target), animated chevron hints on either edge (right on
// every page but the last, left on every page but the first) that also
// jump a page on tap. Built as a single swipeable component instead of
// three permanently-visible sections specifically to avoid showing the
// same podium shape three times in a row on the page — the user's own
// call after finding separate always-on sections too repetitive.
//
// Owns its own data fetching (GET /feed/leaderboard) rather than receiving
// it as props from KesfetSection — the round mode toggle needs to refetch
// just the podium's own 3 lists on tap, not the whole Discover page's
// Promise.all (which would also needlessly re-run Trending/Reviews/Lists).
export default function LeaderboardPodium({ basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<ContentType>("movie");
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboard(mode).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const cycleMode = () => setMode((prev) => MODE_CYCLE[(MODE_CYCLE.indexOf(prev) + 1) % MODE_CYCLE.length]);

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
        // No justify:"space-between" — the toggle sits immediately after
        // the title text, not pushed to the far right edge of the row.
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        // The round movie/series mode toggle, right where the title ends —
        // both icons always visible, only the active one recolored (no
        // filled background chip — the user found that too heavy, wanted
        // just the icon's own color to carry the selected state).
        modeToggle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 34,
          paddingHorizontal: 12,
          borderRadius: 17,
          backgroundColor: colors.base200,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        podiumWrap: { position: "relative" },
        loadingWrap: { height: PODIUM_HEIGHT, alignItems: "center", justifyContent: "center" },
        page: {
          width: screenWidth,
          height: PODIUM_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 16,
          paddingHorizontal: 16,
        },
        arrowHintRight: { position: "absolute", right: 8, top: PODIUM_HEIGHT / 2 - 14 },
        arrowHintLeft: { position: "absolute", left: 8, top: PODIUM_HEIGHT / 2 - 14 },
        arrowCircle: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: hexToRgba(colors.placeholder, 0.16),
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, screenWidth]
  );

  const favoritedPodium = toPodiumOrder(data?.mostFavorited ?? []);
  const ratedPodium = toPodiumOrder(data?.highestRated ?? []);
  const recommendedPodium = toPodiumOrder(data?.mostRecommended ?? []);

  const titles = [t("Most Favorited"), t("Highest Rated"), t("Most Recommended")];

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{titles[page]}</Text>
        <Pressable style={styles.modeToggle} onPress={cycleMode} hitSlop={8}>
          <Ionicons name="film-outline" size={16} color={mode === "movie" ? colors.primary : colors.placeholder} />
          <Ionicons name="tv-outline" size={16} color={mode === "series" ? colors.primary : colors.placeholder} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.podiumWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.page}>
            {favoritedPodium.map(({ item, rank }) => (
              <LeaderboardCard
                key={item.content.id}
                rank={rank}
                content={item.content}
                basePath={basePath}
                metric={{ kind: "favorited", favoriteCount: item.favoriteCount }}
              />
            ))}
          </View>
          <View style={styles.page}>
            {ratedPodium.map(({ item, rank }) => (
              <LeaderboardCard
                key={item.content.id}
                rank={rank}
                content={item.content}
                basePath={basePath}
                metric={{ kind: "rated", avgRating: item.avgRating }}
              />
            ))}
          </View>
          <View style={styles.page}>
            {recommendedPodium.map(({ item, rank }) => (
              <LeaderboardCard
                key={item.content.id}
                rank={rank}
                content={item.content}
                basePath={basePath}
                metric={{ kind: "recommended", recommendCount: item.recommendCount }}
              />
            ))}
          </View>
        </ScrollView>

        {page < PAGE_COUNT - 1 && (
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
