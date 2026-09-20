import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  Easing,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
// Gesture handler's inside the Media feed (TapSafeProvider): see common/TapSafePressable.tsx.
import Pressable from "./common/TapSafePressable";
// From react-native-gesture-handler, not react-native — this podium's own
// horizontal paging nests inside Media's outer horizontal page-switcher
// (home/index.tsx, via SharesFeedSection's vertical FlatList — orthogonal
// axis, fine), so it needs gesture-handler's pan resolution the same way
// LeaderboardPodium.tsx does on the Discover side; a plain RN ScrollView
// here gets its horizontal drags eaten by the outer pager instead.
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import PeoplePodiumCard from "./PeoplePodiumCard";
import PodiumSkeletonSlot from "./PodiumSkeletonSlot";
import UpgradeRibbon from "./UpgradeRibbon";
import { getPeopleLeaderboard } from "../api/feedService";
import { useAuth } from "../context/AuthContext";
import type { ContentType, PeopleLeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Bigger than an earlier round's own 44/34/34 (direct ask: "podyum
// çerçevesini biraz büyüt") — matches LeaderboardPodium.tsx's own
// TEASER_POSTER_WIDTH reasoning exactly.
const TEASER_AVATAR_SIZE = { 1: 56, 2: 44, 3: 44 } as const;
// How often the ad page's whole skeleton row (frames + metric icon
// together) cross-fades to the next teased category — when there are more
// than 2 teased categories (Free's own 4), the banner text in `titleRow`
// cycles in lockstep with this too, same as LeaderboardPodium.tsx's own
// identical pattern.
const TEASER_CYCLE_MS = 2200;
const TEASER_FADE_MS = 280;

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

// The podium's 5 categories, in one fixed canonical order — Most Liked/Top
// Recommenders are the 2 later additions, appended rather than interleaved
// so Premium/dev's own page order stays exactly what it always was for the
// original 3. Icons are only ever shown on the ad page's own skeleton
// frames, reusing the exact same icon PeoplePodiumCard.tsx's own metricRow
// uses for that same metric so the teaser and the real card read as the
// same signal.
// "badges" (Most Decorated — total badge count across both badge families)
// was added later still, once the badge feature itself existed; grouped
// with Liked/Recommended under Premium below for the same reason (a fun,
// socially-exclusive signal rather than an everyday usage stat).
const CATEGORY_KEYS = ["followed", "watched", "reviewed", "liked", "recommended", "badges"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Which categories are fully open (real, unlocked) per tier — the
// remainder are teased together on one ad page. Same 3-way split as
// LeaderboardPodium.tsx's own (see that file's own doc comment for the
// full "why 5, why this particular 3" reasoning) — Followed/Watched/
// Reviewed are the more "everyday app-usage stats" trio kept for Plus,
// while Liked/Recommended (who's most *popular*, who's most *influential*
// — the more socially exclusive signals) stay Premium-only.
const OPEN_KEYS_BY_TIER: Record<"free" | "plus" | "full", CategoryKey[]> = {
  free: ["reviewed"],
  plus: ["reviewed", "watched", "followed"],
  full: [...CATEGORY_KEYS],
};

type PodiumPage = { type: "real"; key: CategoryKey } | { type: "ad"; lockedKeys: CategoryKey[] };

// Media/Shares' own podium — person-based signals that belong on the
// social tab rather than Discover (Discover's own podium,
// LeaderboardPodium.tsx, is deliberately content-only — ranking people
// doesn't help anyone find something to watch). Structurally the same
// shape as that file (own fetch, pagingEnabled horizontal ScrollView,
// both-direction bob-loop arrow hints, the same tier-driven `pages` array
// — see that file's own doc comment for the full mechanics, identical
// here). Only Most Watched has a movie/series dimension, so the mode
// toggle only ever shows while a *real* Most Watched page is active.
//
// Free-tier gated — not with a blur (an earlier version blurred each
// card's photo while its name/count stayed fully readable underneath,
// which a direct report called out as pointless). Locked categories are
// merged into one shared ad page per viewer, same design as
// LeaderboardPodium.tsx's own — every slot on that page is always a blank
// `PodiumSkeletonSlot` frame, full stop, regardless of who's viewing it.
// An earlier version rendered a real `PeoplePodiumCard` instead whenever a
// slot happened to be the *viewer's own* entry — reverted on direct
// correction ("reklam kartı görünüşü fixed olacak, hiçbir durumda
// bozma"): the ad page's whole appeal is that it's a fixed, empty
// silhouette of the podium, never real data, and a self-highlight broke
// that consistency more than it was worth.
//
// Wrapped in React.memo — the one prop it does take (`jumpToCategory`,
// see below) is `undefined` at every render except the one right after
// PodiumNewsModal.tsx's own popup is tapped, so this still only re-renders
// from its own internal state the overwhelming rest of the time, never
// because SharesFeedSection or home/index.tsx above it happened to
// re-render for an unrelated reason (e.g. every tap of the header's
// Paylaşımlar/Keşfet pill) — see SharesFeedSection.tsx's own matching
// comment for the full reasoning.
interface Props {
  // A backend PeopleLeaderboardResult field name lowercased down to this
  // file's own shorter CategoryKey (e.g. "mostLiked" → "liked") — set by
  // PodiumNewsModal.tsx via a `?podiumCategory=` param threaded through
  // home/index.tsx → SharesFeedSection.tsx. On first receiving a real
  // value, jumps straight to that category's own page — its real page if
  // the viewer's own tier has it open, or the shared (always-fixed, never
  // self-highlighted — see the component doc comment above) ad page
  // otherwise, so tapping "you made the podium!" always lands on the right
  // category, even if that category's own real ranking isn't something
  // this viewer's tier can browse.
  jumpToCategory?: string;
}

function PeoplePodium({ jumpToCategory }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // Free/Plus/Premium/dev — same 3-way split as LeaderboardPodium.tsx's own.
  const viewerTier = user?.accountTier ?? "free";
  const tierLevel: "free" | "plus" | "full" = viewerTier === "premium" || viewerTier === "dev" ? "full" : viewerTier === "plus" ? "plus" : "free";
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

  const openKeys = OPEN_KEYS_BY_TIER[tierLevel];
  const lockedKeys = CATEGORY_KEYS.filter((k) => !openKeys.includes(k));
  const hasAdPage = lockedKeys.length > 0;

  // Ad page only — same technique as LeaderboardPodium.tsx's own teaser:
  // the whole skeleton row (frames + metric icon together) cross-fades
  // between the locked categories on a timer, independent of page-swipe.
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
        // minHeight reserves enough room for the ad page's own up-to-
        // 2-line banner sentence regardless of which page is showing — see
        // LeaderboardPodium.tsx's own identical `titleRow` comment for the
        // full reasoning (real bug this fixes: swapping between the short
        // title and the long banner used to change this row's own height,
        // pushing the next section's own divider down while on the ad page).
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 2, minHeight: 46 },
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
        // Ad page (and any real page besides Most Watched) only, alongside
        // modeToggleHidden — the hidden toggle is invisible but, left as a
        // normal flex sibling, still reserves its own width on the row's
        // right side, which centers adBannerTitle's own text within a
        // narrower, off-center box instead of the row's true full width —
        // a real reported bug ("sharesteki podyumun reklam metnini tam
        // ortalayamadın"), the exact same one LeaderboardPodium.tsx's own
        // toggle already needed this fix for; this file just didn't carry
        // it over when the toggle came back for the Most Watched category
        // in the 5-category rewrite. Pulling it out of flex flow via
        // position:"absolute" (still mounted, still invisible, just no
        // longer sized/laid-out as a sibling) fixes it without touching
        // the toggle's own real Most-Watched-page layout, and without ever
        // unmounting it (unmounting is what caused a real vertical-jump
        // bug this "always mounted" pattern was already built to avoid).
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
        // Ad page only — same design as LeaderboardPodium.tsx's own
        // identical ad page. Centers `adFrameRow` in the page's own full
        // height now — no more reserved bottom zone for a button, since the
        // Upgrade Now button became a corner ribbon instead (see that
        // file's own `adPage` doc comment for the full reasoning). PODIUM_
        // HEIGHT is 156px here — see this file's own comment on that
        // constant for why it's snug.
        adPage: { width: screenWidth, height: PODIUM_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, position: "relative" },
        adFrameRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 12 },
        adRibbonWrap: { position: "absolute", top: 4, right: -30 },
        // Sits inside titleRow, replacing the plain category title while
        // the ad page is showing — direct ask ("başlık hizasında reklam
        // metni olacak"). This file's own mode toggle *is* a sibling here
        // too (for the Most Watched category) — modeToggleAbsolute above
        // keeps it from reserving flex width while hidden, the same fix
        // LeaderboardPodium.tsx's own toggle already needed.
        adBannerTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.baseContent, textAlign: "center" },
      }),
    [colors, screenWidth]
  );

  const followedPodium = toPodiumOrder(data?.mostFollowed ?? []);
  const watchedPodium = toPodiumOrder(data?.mostWatched ?? []);
  const reviewedPodium = toPodiumOrder(data?.mostReviewed ?? []);
  const likedPodium = toPodiumOrder(data?.mostLiked ?? []);
  const recommendedPodium = toPodiumOrder(data?.topRecommenders ?? []);
  const badgesPodium = toPodiumOrder(data?.mostBadges ?? []);

  const categoryMeta: Record<CategoryKey, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
    followed: { title: t("Most Followed"), icon: "people-outline" },
    watched: { title: t("Most Watched"), icon: "eye-outline" },
    reviewed: { title: t("Most Reviewed"), icon: "pencil" },
    liked: { title: t("Most Liked"), icon: "heart" },
    recommended: { title: t("Top Recommenders"), icon: "gift" },
    badges: { title: t("Most Decorated"), icon: "ribbon" },
  };
  const podiumByKey: Record<CategoryKey, ReturnType<typeof toPodiumOrder<any>>> = {
    followed: followedPodium,
    watched: watchedPodium,
    reviewed: reviewedPodium,
    liked: likedPodium,
    recommended: recommendedPodium,
    badges: badgesPodium,
  };

  function renderRealCard(key: CategoryKey, rank: 1 | 2 | 3, item: any) {
    // The React key is passed on its own: React doesn't allow `key` inside a
    // spread props object.
    const cardKey = item.user.id as string;
    const common = { rank, user: item.user, locked: false as const };
    switch (key) {
      case "followed":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "followed", count: item.followerCount }} />;
      case "watched":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "watched", count: item.watchedCount }} />;
      case "reviewed":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "reviewed", count: item.reviewCount }} />;
      case "liked":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "liked", count: item.likeCount }} />;
      case "recommended":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "recommended", count: item.recommendCount }} />;
      case "badges":
        return <PeoplePodiumCard key={cardKey} {...common} metric={{ kind: "badges", count: item.badgeCount }} />;
    }
  }

  // Direct correction: an earlier version rendered a real card here
  // instead of a blank frame whenever the slot happened to be the
  // *viewer's own* entry — reverted. The ad page's whole appeal was
  // "fixed, empty rank-medal frames, nothing real ever shown here" (see
  // PodiumSkeletonSlot.tsx's own doc comment); a real photo+name breaking
  // that consistency was worse than the self-highlight was worth,
  // regardless of whether the viewer happens to be that entry — "reklam
  // kartı görünüşü fixed olacak, hiçbir durumda bozma."
  function renderAdSlot(key: CategoryKey, rank: 1 | 2 | 3, _item: any) {
    return <PodiumSkeletonSlot key={rank} rank={rank} shape="circle" size={TEASER_AVATAR_SIZE[rank]} metricIcon={categoryMeta[key].icon} />;
  }

  const pages: PodiumPage[] = [
    ...openKeys.map((key): PodiumPage => ({ type: "real", key })),
    ...(hasAdPage ? ([{ type: "ad", lockedKeys }] as PodiumPage[]) : []),
  ];
  const activePage = pages[page];
  const activeIsWatched = activePage?.type === "real" && activePage.key === "watched";

  // Jump-to-category, once — real page if this viewer's own tier has that
  // category open, else the shared ad page (whichever page has it in its
  // own `lockedKeys`). Guarded on `loading` since the ScrollView (and
  // `scrollRef`) doesn't exist yet during the spinner state; `jumpedRef`
  // stops this from re-firing on every re-render once it's already run —
  // `jumpToCategory` itself only ever changes value once per tap anyway
  // (see this component's own Props doc comment), but re-jumping on
  // unrelated re-renders (a mode toggle, a refetch) would fight whatever
  // page the viewer has since swiped to themselves.
  const jumpedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!jumpToCategory || loading || jumpedRef.current === jumpToCategory) return;
    jumpedRef.current = jumpToCategory;
    const realIndex = pages.findIndex((p) => p.type === "real" && p.key === jumpToCategory);
    const targetIndex = realIndex !== -1 ? realIndex : pages.findIndex((p) => p.type === "ad" && p.lockedKeys.includes(jumpToCategory as CategoryKey));
    if (targetIndex !== -1) goToPage(targetIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToCategory, loading]);

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
            height never changes as `page` updates mid-swipe — a
            conditional mount here previously made the toggle pop in/out
            during the scroll gesture itself (handleScroll updates `page`
            continuously, not just on settle), which changed titleRow's
            height and shifted the whole podium vertically underneath it —
            the exact "sayfa dikeyde hafif kayıyor" the user hit.
            opacity+pointerEvents hide it without ever changing layout.
            Only Most Watched has a movie/series dimension, so this only
            ever becomes usable while that specific real page is active. */}
        <Pressable
          style={[styles.modeToggle, !activeIsWatched && [styles.modeToggleHidden, styles.modeToggleAbsolute]]}
          onPress={cycleMode}
          hitSlop={8}
          pointerEvents={activeIsWatched ? "auto" : "none"}
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
                    {podiumByKey[p.lockedKeys[adCategoryIndex % p.lockedKeys.length]].map(({ item, rank }) =>
                      renderAdSlot(p.lockedKeys[adCategoryIndex % p.lockedKeys.length], rank, item)
                    )}
                  </Animated.View>
                  <View style={styles.adRibbonWrap}>
                    <UpgradeRibbon onPress={() => router.push("/match/subscription" as any)} />
                  </View>
                </View>
              )
            )}
          </ScrollView>

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

export default memo(PeoplePodium);
