import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import PodiumStepCard from "./PodiumStepCard";
import PodiumListRow from "./PodiumListRow";
import PodiumSkeletonSlot from "./PodiumSkeletonSlot";
import UpgradeRibbon from "./UpgradeRibbon";
import SlidingUnderlineTabs from "./SlidingUnderlineTabs";
import { getPeopleLeaderboard } from "../api/feedService";
import { useAuth } from "../context/AuthContext";
import type { ContentType, PeopleLeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const TEASER_AVATAR_SIZE = { 1: 56, 2: 44, 3: 44 } as const;
const MODE_CYCLE: ContentType[] = ["movie", "series"];

// Reorders a rank-1..N-sorted slice into podium display order (2nd, 1st,
// 3rd) for the top-3 steps — identical to LeaderboardPodium.tsx's own
// toPodiumOrder, kept as its own local copy rather than shared/imported,
// matching this app's own established convention for this kind of thing.
function toPodiumOrder<T>(items: T[]): { item: T; rank: 1 | 2 | 3 }[] {
  if (items.length < 3) return items.map((item, i) => ({ item, rank: (i + 1) as 1 | 2 | 3 }));
  return [
    { item: items[1], rank: 2 as const },
    { item: items[0], rank: 1 as const },
    { item: items[2], rank: 3 as const },
  ];
}

const CATEGORY_KEYS = ["followed", "watched", "reviewed", "liked", "recommended", "badges", "puzzle"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const BACKEND_KEY: Record<CategoryKey, keyof PeopleLeaderboardResult> = {
  followed: "mostFollowed",
  watched: "mostWatched",
  reviewed: "mostReviewed",
  liked: "mostLiked",
  recommended: "topRecommenders",
  badges: "mostBadges",
  puzzle: "mostPuzzleStreak",
};

const OPEN_KEYS_BY_TIER: Record<"free" | "plus" | "full", CategoryKey[]> = {
  free: ["reviewed"],
  plus: ["reviewed", "watched", "followed"],
  full: [...CATEGORY_KEYS],
};

const EMPTY_CATEGORY = { entries: [] as any[], viewerEntry: null as any };

type PeopleMetric =
  | { kind: "followed"; count: number }
  | { kind: "watched"; count: number }
  | { kind: "reviewed"; count: number }
  | { kind: "liked"; count: number }
  | { kind: "recommended"; count: number }
  | { kind: "badges"; count: number }
  | { kind: "puzzle"; count: number };

function metricFor(key: CategoryKey, item: any): PeopleMetric {
  switch (key) {
    case "followed":
      return { kind: "followed", count: item.followerCount };
    case "watched":
      return { kind: "watched", count: item.watchedCount };
    case "reviewed":
      return { kind: "reviewed", count: item.reviewCount };
    case "liked":
      return { kind: "liked", count: item.likeCount };
    case "recommended":
      return { kind: "recommended", count: item.recommendCount };
    case "badges":
      return { kind: "badges", count: item.badgeCount };
    case "puzzle":
      return { kind: "puzzle", count: item.puzzleStreak };
  }
}

// Media/Shares' own podium page — person-based signals that belong on the
// social side rather than Discover (Discover's own podium,
// LeaderboardPodium.tsx, is deliberately content-only). Redesigned per
// direct ask/reference screenshot: a raised 3-step top-3 (PodiumStepCard)
// over a real ranked list (PodiumListRow, ranks 4-15), replacing the old
// horizontal-paging "one full-screen page per category" carousel — now
// that this lives on its own dedicated page (app/people-podium.tsx, not
// nested inside Media's own horizontal tab-pager anymore), a plain
// tap-to-select category chip row works fine, no swipe/gesture-handler
// mechanics needed.
//
// Free-tier gated exactly as before — a selected locked category shows a
// blank-frame teaser (PodiumSkeletonSlot x3) + an UpgradeRibbon, scoped to
// just that one category now (the old "merge every locked category onto
// one shared, auto-cycling ad page" mechanism is gone — the viewer already
// chose which locked category to peek at by tapping its chip, so there's
// nothing left to cycle through).
interface Props {
  // A backend PeopleLeaderboardResult field name lowercased down to this
  // file's own shorter CategoryKey (e.g. "mostLiked" → "liked") — set by
  // app/people-podium.tsx reading its own `?jumpToCategory=` param, sent by
  // PodiumNewsModal.tsx's "you made the podium!" popup.
  jumpToCategory?: string;
}

function PeoplePodium({ jumpToCategory }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const viewerTier = user?.accountTier ?? "free";
  const tierLevel: "free" | "plus" | "full" = viewerTier === "premium" || viewerTier === "dev" ? "full" : viewerTier === "plus" ? "plus" : "free";
  const openKeys = OPEN_KEYS_BY_TIER[tierLevel];

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(openKeys[0]);
  const [mode, setMode] = useState<ContentType>("movie");
  const [data, setData] = useState<PeopleLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading` — true only while re-fetching after a mode
  // change, once the podium has already loaded once, so a mode toggle
  // doesn't flash the whole list out to a spinner.
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

  // `description` is new, direct ask — a first-time viewer had no idea
  // what a given category's own ranking actually meant ("bu neyin
  // leaderboardu bilmiyor"). Shown centered under the category title.
  const categoryMeta: Record<CategoryKey, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = {
    followed: { title: t("Most Followed"), description: t("The most-followed members on Cinephix."), icon: "people-outline" },
    watched: { title: t("Most Watched"), description: t("Members with the largest Watched List."), icon: "eye-outline" },
    reviewed: { title: t("Most Reviewed"), description: t("The most active reviewers."), icon: "pencil" },
    liked: { title: t("Most Liked"), description: t("Whose posts get the most likes."), icon: "heart" },
    recommended: { title: t("Top Recommenders"), description: t("Who recommends the most titles."), icon: "gift" },
    badges: { title: t("Most Decorated"), description: t("The most badges earned."), icon: "ribbon" },
    puzzle: { title: t("Puzzle Streak"), description: t("The longest daily puzzle streaks."), icon: "flame" },
  };

  // Jump-to-category, once — just a direct selection now (no scroll/page
  // index to resolve), since the category chips replaced the old
  // horizontal-paging mechanism entirely.
  const jumpedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!jumpToCategory || jumpedRef.current === jumpToCategory) return;
    jumpedRef.current = jumpToCategory;
    if ((CATEGORY_KEYS as readonly string[]).includes(jumpToCategory)) setSelectedCategory(jumpToCategory as CategoryKey);
  }, [jumpToCategory]);

  const isLocked = !openKeys.includes(selectedCategory);
  const activeIsWatched = !isLocked && selectedCategory === "watched";
  const viewerId = user?._id;

  const categoryData = (data?.[BACKEND_KEY[selectedCategory]] as typeof EMPTY_CATEGORY) ?? EMPTY_CATEGORY;
  const top3 = toPodiumOrder(categoryData.entries.slice(0, 3));
  const rest = categoryData.entries.slice(3);
  const viewerEntry = categoryData.viewerEntry;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 24 },
        // Centered title + description, direct ask — a first-time viewer
        // had no idea what a given category's ranking even meant.
        // position:"relative" so modeToggle (Watched only) can sit
        // absolute in its own top-right corner without disturbing the
        // centered text stack.
        categoryHeader: { paddingHorizontal: 32, paddingTop: 14, alignItems: "center", position: "relative", minHeight: 56 },
        // Exact same title treatment as LeaderboardPodium.tsx's own
        // (Discover's Content Podium) — direct ask to match it verbatim:
        // fonts.boldItalic (the real loaded bold-italic family, not a
        // synthetic fontStyle:"italic" on the plain bold one), rendered
        // .toUpperCase(). That file renders it left-aligned next to its
        // own toggle; here it's centered instead, same text style.
        categoryTitle: { fontFamily: fonts.boldItalic, fontSize: 17, color: colors.placeholder, textAlign: "center" },
        categoryDescription: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.placeholder, textAlign: "center", marginTop: 4 },
        adBannerTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.baseContent, textAlign: "center", marginTop: 4 },
        modeToggle: {
          position: "absolute",
          top: 10,
          right: 16,
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
        loadingWrap: { height: 160, alignItems: "center", justifyContent: "center" },
        refetchOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base100 + "99",
        },
        // Relatively positioned so glowWrap below can sit absolute within
        // it, starting flush under the tab bar with no gap — direct ask,
        // the background wash itself should start there even though
        // titleRow/the steps+list keep their own existing spacing.
        contentArea: { position: "relative" },
        // Subtle nod to the reference image's own glow behind the steps —
        // kept restrained (one low-alpha gradient, not a custom SVG
        // radial), direct ask not to overdo it.
        glowWrap: { position: "absolute", left: 0, right: 0, top: 0, height: 140, alignItems: "center" },
        stepsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 14, paddingHorizontal: 16, paddingTop: 12 },
        listWrap: { paddingHorizontal: 10, marginTop: 18, gap: 2 },
        pinnedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8, marginHorizontal: 12 },
        adPage: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 28, position: "relative" },
        adFrameRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 12 },
        adRibbonWrap: { position: "absolute", top: 4, right: 20 },
      }),
    [colors]
  );

  return (
    <View style={styles.section}>
      <SlidingUnderlineTabs
        tabs={CATEGORY_KEYS.map((key) => ({ key, label: categoryMeta[key].title, icon: categoryMeta[key].icon, locked: !openKeys.includes(key) }))}
        activeKey={selectedCategory}
        onChange={(key) => setSelectedCategory(key as CategoryKey)}
      />

      <View style={styles.contentArea}>
        {/* Direct ask: the theme-colored background wash should start
            flush under the tabs with no gap, regardless of categoryHeader's
            own height — positioned absolute within this relative container
            (which itself starts right after SlidingUnderlineTabs), as a
            background layer behind categoryHeader/the steps+list, not
            moving the actual leaderboard content itself. */}
        {!loading && !isLocked && (
          <View style={styles.glowWrap} pointerEvents="none">
            <LinearGradient colors={[colors.primary + "26", colors.primary + "00"]} style={{ width: "100%", height: "100%" }} />
          </View>
        )}
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{categoryMeta[selectedCategory].title.toUpperCase()}</Text>
          {isLocked ? (
            <Text style={styles.adBannerTitle}>{t("Upgrade to Plus or Premium to see {{category}}", { category: categoryMeta[selectedCategory].title })}</Text>
          ) : (
            <Text style={styles.categoryDescription}>{categoryMeta[selectedCategory].description}</Text>
          )}
          <Pressable
            style={[styles.modeToggle, !activeIsWatched && styles.modeToggleHidden]}
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
        ) : isLocked ? (
          <View style={styles.adPage}>
            <View style={styles.adFrameRow}>
              {([1, 2, 3] as const).map((rank) => (
                <PodiumSkeletonSlot key={rank} rank={rank} shape="circle" size={TEASER_AVATAR_SIZE[rank]} metricIcon={categoryMeta[selectedCategory].icon} />
              ))}
            </View>
            <View style={styles.adRibbonWrap}>
              <UpgradeRibbon onPress={() => router.push("/match/subscription" as any)} />
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.stepsRow}>
              {top3.map(({ item, rank }) => (
                <PodiumStepCard key={item.user.id} rank={rank} user={item.user} metric={metricFor(selectedCategory, item)} locked={false} />
              ))}
            </View>
            <View style={styles.listWrap}>
              {rest.map((item) => (
                <PodiumListRow
                  key={item.user.id}
                  rank={item.rank}
                  user={item.user}
                  metric={metricFor(selectedCategory, item)}
                  highlight={item.user.id === viewerId}
                />
              ))}
              {viewerEntry && (
                <>
                  <View style={styles.pinnedDivider} />
                  <PodiumListRow rank={viewerEntry.rank} user={viewerEntry.user} metric={metricFor(selectedCategory, viewerEntry)} highlight />
                </>
              )}
            </View>
            {refetching && (
              <View style={styles.refetchOverlay}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default memo(PeoplePodium);
