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
import { useRouter } from "expo-router";
import LeaderboardCard from "./LeaderboardCard";
import PodiumSkeletonSlot from "./PodiumSkeletonSlot";
import { getLeaderboard } from "../api/feedService";
import { useAuth } from "../context/AuthContext";
import type { ContentType, LeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Bigger than earlier rounds' own 64/50/50 then 70/56/56 (direct ask,
// twice now: "podyum çerçevesini biraz büyüt"). Centered in the space
// *above* the button specifically, not the page's full height — see
// `adPage`'s own `paddingBottom`/`AD_BUTTON_ZONE` below.
const TEASER_POSTER_WIDTH = { 1: 78, 2: 62, 3: 62 } as const;
// Reserved height at the bottom of `adPage` for the upgrade button, kept
// out of the frame row's own centering calculation — see `adPage`'s own
// doc comment for the full reasoning.
const AD_BUTTON_ZONE = 40;
// How often the ad page's whole skeleton row (frames + metric icon
// together) cross-fades to the next teased category — when there are more
// than 2 teased categories (Free's own 4), the banner text in `titleRow`
// cycles in lockstep with this too (see `adBannerIndex` below).
const TEASER_CYCLE_MS = 2200;
const TEASER_FADE_MS = 280;

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

// The podium's 5 categories, in one fixed canonical order — Most Watched/
// Most Reviewed are the 2 later additions, appended rather than
// interleaved so Premium/dev's own page order stays exactly what it
// always was for the original 3. Icons are only ever shown on the ad
// page's own skeleton frames (a locked category's "teaser"), reusing the
// exact same icon LeaderboardCard.tsx's own metricRow uses for that same
// metric so the teaser and the real card read as the same signal.
const CATEGORY_KEYS = ["favorited", "rated", "recommended", "watched", "reviewed"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Which categories are fully open (real, unlocked) per tier — the
// remainder are teased together on one ad page. 5 categories was
// deliberately chosen as "an optimal round number" once this 3-way split
// was on the table (direct ask), so Free gets 1 open + 4 teased, Plus
// gets 3 open + 2 teased, Premium/dev get all 5 open (no ad page at all).
// Rated/Watched/Reviewed were picked for Plus (over Favorited/Recommended)
// for the same reasoning Free's own "Highest Rated" choice used originally
// — Rated/Watched/Reviewed are all closer to "objective app-usage stats,"
// while Favorited/Recommended stay the more exclusive, community-taste
// signals reserved for Premium.
const OPEN_KEYS_BY_TIER: Record<"free" | "plus" | "full", CategoryKey[]> = {
  free: ["rated"],
  plus: ["rated", "watched", "reviewed"],
  full: [...CATEGORY_KEYS],
};

type PodiumPage = { type: "real"; key: CategoryKey } | { type: "ad"; lockedKeys: CategoryKey[] };

// One podium, its page count and mix of real/locked pages driven entirely
// by the viewer's own tier (see OPEN_KEYS_BY_TIER above) — a real
// horizontal-paging ScrollView (genuinely swipeable, not just a tap
// target), animated chevron hints on either edge (right on every page but
// the last, left on every page but the first) that also jump a page on
// tap. Built as a single swipeable component instead of permanently-
// visible sections specifically to avoid showing the same podium shape
// repeatedly in a row on the page — the user's own call after finding
// separate always-on sections too repetitive.
//
// Owns its own data fetching (GET /feed/leaderboard) rather than receiving
// it as props from KesfetSection — the round mode toggle needs to refetch
// just the podium's own lists on tap, not the whole Discover page's
// Promise.all (which would also needlessly re-run Trending/Reviews/Lists).
//
// Free-tier gated — but not with a blur: an earlier version rendered every
// card's poster blurred+locked while its title/rank/metric stayed fully
// visible underneath, which a direct report called out as pointless (the
// blur hid nothing that actually mattered). Locked categories instead get
// merged into one shared "ad page" per viewer (1-4 of the 5 categories,
// depending on tier) — a centered rank-medal skeleton frame row
// (PodiumSkeletonSlot, empty — no poster/title/count for any of them) that
// cross-fades between the locked categories' own metric icons on a timer,
// a banner sentence naming them (single category if 1 is locked... though
// that case doesn't occur under the current tier split; "X and Y" if
// exactly 2 are locked; cycling one-at-a-time if more) sitting in
// `titleRow` itself, and an upgrade button. Every open category still gets
// its own full real page, exactly like Premium/dev's own unlocked view.
export default function LeaderboardPodium({ basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<ContentType>("movie");
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading` — true only while re-fetching after a mode
  // change, once the podium has already loaded once. Real bug this fixes,
  // reported live: `loading` used to swap the whole ScrollView out for a
  // spinner on *every* mode toggle, not just the first load — the
  // ScrollView unmounting loses its scroll offset, so a fresh one remounts
  // back at page 0 while `page` state itself (driven by onScroll) was never
  // reset, leaving the title (`titles[page]`) and the actually-displayed
  // page out of sync — "kategori ve yüklenen bilgiler karışıyor". Same fix
  // already applied to Medya's own PeoplePodium.tsx: `refetching` keeps the
  // ScrollView mounted (current page/scroll position stays put) and only
  // overlays a small spinner on top.
  const [refetching, setRefetching] = useState(false);
  const didInitialLoad = useRef(false);
  // Free/Plus/Premium/dev — same 3-way split as everywhere else this tier
  // is checked (Sync's canUseMatchFilters, Medya's own PeoplePodium), just
  // with an explicit "plus" level now instead of a plain locked/unlocked
  // boolean, since Plus and Premium no longer see the same thing here.
  const viewerTier = user?.accountTier ?? "free";
  const tierLevel: "free" | "plus" | "full" = viewerTier === "premium" || viewerTier === "dev" ? "full" : viewerTier === "plus" ? "plus" : "free";

  useEffect(() => {
    let cancelled = false;
    if (!didInitialLoad.current) {
      setLoading(true);
    } else {
      setRefetching(true);
    }
    getLeaderboard(mode).then((res) => {
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

  const openKeys = OPEN_KEYS_BY_TIER[tierLevel];
  const lockedKeys = CATEGORY_KEYS.filter((k) => !openKeys.includes(k));
  const hasAdPage = lockedKeys.length > 0;

  // Ad page only: alternates the whole skeleton row (frames + metric icon
  // together, not just the icon on its own — a direct correction: "smooth
  // fade away geçişli olan sadece semboller değil frameler de olsun. yani
  // tüm iskelet") between the locked categories on a timer, independent of
  // page-swipe. The banner text in `titleRow` advances in lockstep when
  // there are more than 2 locked categories (Free's own 4) — see
  // `adBannerText` below.
  const [adCategoryIndex, setAdCategoryIndex] = useState(0);
  const teaserFadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!hasAdPage) return;
    setAdCategoryIndex(0);
    if (lockedKeys.length < 2) return;
    const interval = setInterval(() => {
      Animated.timing(teaserFadeAnim, { toValue: 0, duration: TEASER_FADE_MS, useNativeDriver: true }).start(() => {
        setAdCategoryIndex((i) => (i + 1) % lockedKeys.length);
        Animated.timing(teaserFadeAnim, { toValue: 1, duration: TEASER_FADE_MS, useNativeDriver: true }).start();
      });
    }, TEASER_CYCLE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAdPage, lockedKeys.length, teaserFadeAnim]);

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
        // minHeight reserves enough room for the ad page's own up-to-2-line
        // banner sentence *regardless* of which page is currently showing
        // — the actual fix for a real reported bug: this row used to only
        // grow taller while the banner was visible, and since neither this
        // row nor the component's own outer `section` has a fixed height,
        // that genuine height difference pushed everything below this
        // whole component down while on the ad page, then back up when
        // swiping away. A fixed floor here means swapping between the
        // short title and the long banner never changes this row's own
        // footprint either way.
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12, minHeight: 46 },
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
        modeToggleHidden: { opacity: 0 },
        // Ad page only, alongside modeToggleHidden — the hidden toggle is
        // invisible but, left as a normal flex sibling, still reserves its
        // own width on the row's right side, which would center
        // adBannerTitle's own text within a narrower, off-center box
        // instead of the row's true full width. Pulling it out of flex
        // flow via position:"absolute" (still mounted, still invisible,
        // just no longer sized/laid-out as a sibling) fixes that without
        // touching the toggle's own real open-page layout, and without
        // ever unmounting it (unmounting is what caused a real vertical-
        // jump bug this "always mounted" pattern was already built to
        // avoid).
        modeToggleAbsolute: { position: "absolute", right: 0 },
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
        // Ad page only — just the frame row + button (the banner sentence
        // lives in `titleRow` instead, see `adBannerTitle` below).
        // `paddingBottom: AD_BUTTON_ZONE` carves out reserved space at the
        // bottom for the button *before* `justifyContent:"center"` ever
        // centers `adFrameRow` — so the frame row centers within the
        // *remaining* space above that reserved zone, not the page's full
        // height, landing it visually between the banner (in titleRow,
        // right above this whole page) and the button (in that reserved
        // zone) rather than dead-center of the page as a whole — direct
        // ask ("çerçeveyi upgrade butonu ile reklam metninin ortasına
        // hizala"). The button itself is `position:"absolute"` within that
        // same reserved zone (`adButtonWrap`, `bottom:8` — direct ask to
        // sit close to whatever comes right after this whole component,
        // "alt çizgiye yaklaştır"), independent of the frame row's own
        // exact height so neither one can ever push into the other.
        adPage: { width: screenWidth, height: PODIUM_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingBottom: AD_BUTTON_ZONE, position: "relative" },
        adFrameRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 12 },
        adButtonWrap: { position: "absolute", left: 0, right: 0, bottom: 8, alignItems: "center" },
        // Sits inside titleRow itself, replacing the plain category title
        // there while the ad page is showing — direct ask ("başlık hizasında
        // reklam metni olacak"). titleRow's own `minHeight:46` already
        // reserves room for this sentence's own up-to-2-line height
        // regardless of which page is active, so swapping between this and
        // the plain `title` text never changes titleRow's own footprint.
        adBannerTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.baseContent, textAlign: "center" },
        upgradeButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 18,
          backgroundColor: colors.primary,
        },
        upgradeButtonText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primaryContent },
      }),
    [colors, screenWidth]
  );

  const favoritedPodium = toPodiumOrder(data?.mostFavorited ?? []);
  const ratedPodium = toPodiumOrder(data?.highestRated ?? []);
  const recommendedPodium = toPodiumOrder(data?.mostRecommended ?? []);
  const watchedPodium = toPodiumOrder(data?.mostWatched ?? []);
  const reviewedPodium = toPodiumOrder(data?.mostReviewed ?? []);

  const categoryMeta: Record<CategoryKey, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
    favorited: { title: t("Most Favorited"), icon: "star" },
    rated: { title: t("Highest Rated"), icon: "trophy" },
    recommended: { title: t("Most Recommended"), icon: "gift" },
    watched: { title: t("Most Watched"), icon: "eye" },
    reviewed: { title: t("Most Reviewed"), icon: "create" },
  };
  const podiumByKey: Record<CategoryKey, ReturnType<typeof toPodiumOrder<any>>> = {
    favorited: favoritedPodium,
    rated: ratedPodium,
    recommended: recommendedPodium,
    watched: watchedPodium,
    reviewed: reviewedPodium,
  };

  function renderRealCard(key: CategoryKey, rank: 1 | 2 | 3, item: any) {
    // The React key is passed on its own: React doesn't allow `key` inside a
    // spread props object.
    const cardKey = item.content.id as string;
    const common = { rank, content: item.content, basePath, locked: false as const };
    switch (key) {
      case "favorited":
        return <LeaderboardCard key={cardKey} {...common} metric={{ kind: "favorited", favoriteCount: item.favoriteCount }} />;
      case "rated":
        return <LeaderboardCard key={cardKey} {...common} metric={{ kind: "rated", avgRating: item.avgRating }} />;
      case "recommended":
        return <LeaderboardCard key={cardKey} {...common} metric={{ kind: "recommended", recommendCount: item.recommendCount }} />;
      case "watched":
        return <LeaderboardCard key={cardKey} {...common} metric={{ kind: "watched", watchedCount: item.watchedCount }} />;
      case "reviewed":
        return <LeaderboardCard key={cardKey} {...common} metric={{ kind: "reviewed", reviewCount: item.reviewCount }} />;
    }
  }

  const pages: PodiumPage[] = [
    ...openKeys.map((key): PodiumPage => ({ type: "real", key })),
    ...(hasAdPage ? ([{ type: "ad", lockedKeys }] as PodiumPage[]) : []),
  ];
  const activePage = pages[page];

  const adBannerText =
    lockedKeys.length >= 3
      ? t("Upgrade to Plus or Premium to see {{category}}", { category: categoryMeta[lockedKeys[adCategoryIndex % lockedKeys.length]].title })
      : t("Upgrade to Plus or Premium to see {{first}} and {{second}}", {
          first: categoryMeta[lockedKeys[0]]?.title ?? "",
          second: categoryMeta[lockedKeys[1]]?.title ?? "",
        });

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        {activePage?.type === "real" ? (
          <Text style={styles.title}>{categoryMeta[activePage.key].title}</Text>
        ) : (
          <Text style={styles.adBannerTitle}>{adBannerText}</Text>
        )}
        {/* Always rendered (never conditionally mounted) so titleRow's own
            height never changes as `page` updates mid-swipe — see
            titleRow's own doc comment. Visible+usable on every *real* page
            now (every one of the 5 categories respects `?type=`, unlike
            the people podium's own Most Watched-only dimension), hidden
            only on the ad page. */}
        <Pressable
          style={[styles.modeToggle, activePage?.type !== "real" && [styles.modeToggleHidden, styles.modeToggleAbsolute]]}
          onPress={cycleMode}
          hitSlop={8}
          pointerEvents={activePage?.type === "real" ? "auto" : "none"}
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
          <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
            {pages.map((p) =>
              p.type === "real" ? (
                <View key={p.key} style={styles.page}>
                  {podiumByKey[p.key].map(({ item, rank }) => renderRealCard(p.key, rank, item))}
                </View>
              ) : (
                <View key="ad" style={styles.adPage}>
                  <Animated.View style={[styles.adFrameRow, { opacity: teaserFadeAnim }]}>
                    {[2, 1, 3].map((rank) => (
                      <PodiumSkeletonSlot
                        key={rank}
                        rank={rank as 1 | 2 | 3}
                        shape="poster"
                        size={TEASER_POSTER_WIDTH[rank as 1 | 2 | 3]}
                        metricIcon={categoryMeta[p.lockedKeys[adCategoryIndex % p.lockedKeys.length]].icon}
                      />
                    ))}
                  </Animated.View>
                  <View style={styles.adButtonWrap}>
                    <Pressable style={styles.upgradeButton} onPress={() => router.push("/match/subscription" as any)}>
                      <Ionicons name="sparkles" size={13} color={colors.primaryContent} />
                      <Text style={styles.upgradeButtonText}>{t("Upgrade Now")}</Text>
                    </Pressable>
                  </View>
                </View>
              )
            )}
          </ScrollView>

          {refetching && (
            <View style={styles.refetchOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {page < pages.length - 1 && (
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
