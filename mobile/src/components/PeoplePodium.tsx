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
// horizontal paging nests inside Medya's outer horizontal page-switcher
// (home/index.tsx, via SharesFeedSection's vertical FlatList — orthogonal
// axis, fine), so it needs gesture-handler's pan resolution the same way
// LeaderboardPodium.tsx does on the Discover side; a plain RN ScrollView
// here gets its horizontal drags eaten by the outer pager instead.
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PeoplePodiumCard from "./PeoplePodiumCard";
import { getPeopleLeaderboard } from "../api/feedService";
import type { ContentType, PeopleLeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const MODE_CYCLE: ContentType[] = ["movie", "series"];

// Same bob-loop hint technique as LeaderboardPodium.tsx (itself borrowed
// from MatchSummarySwiper.tsx's scroll-hint chevron).
const HINT_BOB_MS = 900;
const HINT_BOB_DISTANCE = 5;
// Tight fit for rank-1's own content stack (88px avatar + ~8px margin +
// 5px platform line + ~6px margin + ~16px username line + ~3px margin +
// ~16px metric row ≈ 142px), plus a little headroom for the rank badge's
// own 11px overhang above the avatar — deliberately snug, not the old 200
// (which left ~60px of dead space above the cards, since they're bottom-
// anchored in this box — that dead space was the real cause of the podium
// reading as "too far from its own title", not the titleRow spacing).
const PODIUM_HEIGHT = 156;
const PAGE_COUNT = 3;
// Most Watched is the only one of the 3 pages with a movie/series
// dimension — the toggle only renders while this page is showing.
const WATCHED_PAGE_INDEX = 1;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Reorders a rank-1..3-sorted list into podium display order (2nd, 1st,
// 3rd) — identical to LeaderboardPodium.tsx's own toPodiumOrder, kept as
// its own local copy rather than shared/imported (small, one-off helper,
// matches this app's own established convention for this kind of thing).
function toPodiumOrder<T>(items: T[]): { item: T; rank: 1 | 2 | 3 }[] {
  if (items.length < 3) return items.map((item, i) => ({ item, rank: (i + 1) as 1 | 2 | 3 }));
  return [
    { item: items[1], rank: 2 as const },
    { item: items[0], rank: 1 as const },
    { item: items[2], rank: 3 as const },
  ];
}

// Medya/Shares' own podium — Most Followed / Most Watched / Most Reviewed,
// person-based signals that belong on the social tab rather than Discover
// (Discover's own podium, LeaderboardPodium.tsx, is deliberately
// content-only — ranking people doesn't help anyone find something to
// watch). Structurally a copy of LeaderboardPodium.tsx's own shape (owns
// its own fetch, pagingEnabled horizontal ScrollView, both-direction
// bob-loop arrow hints) — the one real difference is the movie/series mode
// toggle only renders on the Most Watched page, since Most Followed/Most
// Reviewed have no type dimension at all.
export default function PeoplePodium() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<ContentType>("movie");
  const [data, setData] = useState<PeopleLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading` — true only while re-fetching after a mode
  // change, once the podium has already loaded once. `loading` swaps the
  // whole ScrollView out for a spinner, which reset scroll position back to
  // page 0 on every mode toggle (the ScrollView unmounting loses its scroll
  // offset) — the exact bug the user hit ("mod değiştirsem bile o podyum
  // ekranında durmalı"). `refetching` instead keeps the ScrollView mounted
  // (current page stays put) and only overlays a small spinner on top,
  // same "don't remount the thing the user is looking at" fix already
  // applied once in SharesFeedSection.tsx for its own former filter.
  const [refetching, setRefetching] = useState(false);
  const didInitialLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!didInitialLoad.current) {
      setLoading(true);
    } else {
      setRefetching(true);
    }
    getPeopleLeaderboard(mode).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
        setRefetching(false);
        didInitialLoad.current = true;
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
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 2 },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
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
        modeToggleHidden: { opacity: 0 },
        podiumWrap: { position: "relative" },
        loadingWrap: { height: PODIUM_HEIGHT, alignItems: "center", justifyContent: "center" },
        refetchOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexToRgba(colors.base100, 0.6),
        },
        // space-evenly instead of center — with only 3 cards and a lot of
        // spare row width, "center" packed them into one tight cluster in
        // the middle with dead space on both sides; space-evenly spreads
        // them across the row's actual width instead, without touching
        // each card's own size.
        page: {
          width: screenWidth,
          height: PODIUM_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-evenly",
          paddingHorizontal: 16,
        },
        // Cards are bottom-anchored in `page` (the podium-floor look —
        // rank 1's bigger avatar is what makes it read as "standing
        // taller"), so their visual center sits well below the box's own
        // geometric middle. Anchored from the bottom instead of PODIUM_
        // HEIGHT/2 for the same reason the cards themselves are: rank 1's
        // avatar (88px) sits above its platform line + username + metric
        // row (~50px total), so its own vertical center is ~94px up from
        // the floor — minus half the arrow circle (14) puts the circle's
        // own bottom edge, and so its center, right on that mark.
        arrowHintRight: { position: "absolute", right: 8, bottom: 80 },
        arrowHintLeft: { position: "absolute", left: 8, bottom: 80 },
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

  const followedPodium = toPodiumOrder(data?.mostFollowed ?? []);
  const watchedPodium = toPodiumOrder(data?.mostWatched ?? []);
  const reviewedPodium = toPodiumOrder(data?.mostReviewed ?? []);

  const titles = [t("Most Followed"), t("Most Watched"), t("Most Reviewed")];

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{titles[page]}</Text>
        {/* Always rendered (never conditionally mounted) so titleRow's own
            height never changes as `page` updates mid-swipe — a
            conditional {page === WATCHED_PAGE_INDEX && <Pressable/>} here
            previously made the toggle pop in/out during the scroll gesture
            itself (handleScroll updates `page` continuously, not just on
            settle), which changed titleRow's height and shifted the whole
            podium vertically underneath it — the exact "sayfa dikeyde
            hafif kayıyor" the user hit. opacity+pointerEvents hide it
            without ever changing layout. */}
        <Pressable
          style={[styles.modeToggle, page !== WATCHED_PAGE_INDEX && styles.modeToggleHidden]}
          onPress={cycleMode}
          hitSlop={8}
          pointerEvents={page === WATCHED_PAGE_INDEX ? "auto" : "none"}
        >
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
              {followedPodium.map(({ item, rank }) => (
                <PeoplePodiumCard key={item.user.id} rank={rank} user={item.user} metric={{ kind: "followed", count: item.followerCount }} />
              ))}
            </View>
            <View style={styles.page}>
              {watchedPodium.map(({ item, rank }) => (
                <PeoplePodiumCard key={item.user.id} rank={rank} user={item.user} metric={{ kind: "watched", count: item.watchedCount }} />
              ))}
            </View>
            <View style={styles.page}>
              {reviewedPodium.map(({ item, rank }) => (
                <PeoplePodiumCard key={item.user.id} rank={rank} user={item.user} metric={{ kind: "reviewed", count: item.reviewCount }} />
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

          {refetching && (
            <View style={styles.refetchOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
