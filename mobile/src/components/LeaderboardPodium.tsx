import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import LeaderboardCard from "./LeaderboardCard";
import LeaderboardListRow from "./LeaderboardListRow";
import PodiumSkeletonSlot from "./PodiumSkeletonSlot";
import UpgradeRibbon from "./UpgradeRibbon";
import SlidingUnderlineTabs from "./SlidingUnderlineTabs";
import { getLeaderboard } from "../api/feedService";
import { useAuth } from "../context/AuthContext";
import type { ContentType, LeaderboardResult } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const TEASER_POSTER_WIDTH = { 1: 78, 2: 62, 3: 62 } as const;
const MODE_CYCLE: ContentType[] = ["movie", "series"];

// Reorders a rank-1..N-sorted slice into podium display order (2nd, 1st,
// 3rd) for the top-3 steps — identical to Media's own PeoplePodium.tsx
// copy, kept as its own local copy rather than shared/imported, matching
// this app's own established convention for this kind of thing.
function toPodiumOrder<T>(items: T[]): { item: T; rank: 1 | 2 | 3 }[] {
  if (items.length < 3) return items.map((item, i) => ({ item, rank: (i + 1) as 1 | 2 | 3 }));
  return [
    { item: items[1], rank: 2 as const },
    { item: items[0], rank: 1 as const },
    { item: items[2], rank: 3 as const },
  ];
}

const CATEGORY_KEYS = ["favorited", "rated", "recommended", "watched", "reviewed"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const BACKEND_KEY: Record<CategoryKey, keyof LeaderboardResult> = {
  favorited: "mostFavorited",
  rated: "highestRated",
  recommended: "mostRecommended",
  watched: "mostWatched",
  reviewed: "mostReviewed",
};

// 5 categories was deliberately chosen as "an optimal round number" once
// the 3-way Free/Plus/Premium split was on the table (direct ask), so
// Free gets 1 open + 4 teased, Plus gets 3 open + 2 teased, Premium/dev
// get all 5 open (no teaser at all). Rated/Watched/Reviewed were picked
// for Plus (over Favorited/Recommended) as the more "objective app-usage
// stats" trio, while Favorited/Recommended stay the more exclusive,
// community-taste signals reserved for Premium.
const OPEN_KEYS_BY_TIER: Record<"free" | "plus" | "full", CategoryKey[]> = {
  free: ["rated"],
  plus: ["rated", "watched", "reviewed"],
  full: [...CATEGORY_KEYS],
};

const EMPTY_ENTRIES: any[] = [];

type LeaderboardMetric =
  | { kind: "favorited"; favoriteCount: number }
  | { kind: "rated"; avgRating: number }
  | { kind: "recommended"; recommendCount: number }
  | { kind: "watched"; watchedCount: number }
  | { kind: "reviewed"; reviewCount: number };

function metricFor(key: CategoryKey, item: any): LeaderboardMetric {
  switch (key) {
    case "favorited":
      return { kind: "favorited", favoriteCount: item.favoriteCount };
    case "rated":
      return { kind: "rated", avgRating: item.avgRating };
    case "recommended":
      return { kind: "recommended", recommendCount: item.recommendCount };
    case "watched":
      return { kind: "watched", watchedCount: item.watchedCount };
    case "reviewed":
      return { kind: "reviewed", reviewCount: item.reviewCount };
  }
}

interface Props {
  basePath: "/home" | "/search";
}

// Discover's own podium page — content-only signals (ranking people
// doesn't help anyone find something to watch, which is Discover's whole
// point; Media's own PeoplePodium.tsx covers the person-ranking side).
// Redesigned to match that file's own steps+list pattern exactly, direct
// ask/follow-up after the People Podium redesign — a raised 3-step top-3
// (LeaderboardCard) over a real ranked list (LeaderboardListRow, ranks
// 4-15), replacing the old horizontal-paging "one full-screen page per
// category" carousel. No "your own rank" pinned row here — unlike a
// person, a movie/series has no viewer-specific placement to show.
//
// Free-tier gated exactly as before — a selected locked category shows a
// blank-frame teaser (PodiumSkeletonSlot x3, shape="poster") + an
// UpgradeRibbon, scoped to just that one category (the old "merge every
// locked category onto one shared, auto-cycling ad page" mechanism is
// gone, same simplification already made on the People Podium side).
export default function LeaderboardPodium({ basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const viewerTier = user?.accountTier ?? "free";
  const tierLevel: "free" | "plus" | "full" = viewerTier === "premium" || viewerTier === "dev" ? "full" : viewerTier === "plus" ? "plus" : "free";
  const openKeys = OPEN_KEYS_BY_TIER[tierLevel];

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(openKeys[0]);
  const [mode, setMode] = useState<ContentType>("movie");
  const [data, setData] = useState<LeaderboardResult | null>(null);
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

  // `description` is new, direct ask — a first-time viewer had no idea
  // what a given category's own ranking actually meant.
  const categoryMeta: Record<CategoryKey, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = {
    favorited: { title: t("Most Favorited"), description: t("The most-favorited titles on Cinephix."), icon: "star" },
    rated: { title: t("Highest Rated"), description: t("The highest-rated titles, by community score."), icon: "trophy" },
    recommended: { title: t("Most Recommended"), description: t("The titles recommended the most."), icon: "gift" },
    watched: { title: t("Most Watched"), description: t("The titles in the most members' Watched Lists."), icon: "eye" },
    reviewed: { title: t("Most Reviewed"), description: t("The most-reviewed titles."), icon: "create" },
  };

  const isLocked = !openKeys.includes(selectedCategory);
  const entries: any[] = (data?.[BACKEND_KEY[selectedCategory]] as any[]) ?? EMPTY_ENTRIES;
  const top3 = toPodiumOrder(entries.slice(0, 3));
  const rest = entries.slice(3);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 24 },
        // Centered title + description, direct ask — a first-time viewer
        // had no idea what a given category's ranking even meant. Exact
        // same title treatment this file's own title already had
        // (fonts.boldItalic, colors.placeholder, .toUpperCase()) — just
        // centered now instead of left-aligned next to the toggle.
        categoryHeader: { paddingHorizontal: 32, paddingTop: 14, alignItems: "center", position: "relative", minHeight: 56 },
        categoryTitle: { fontFamily: fonts.boldItalic, fontSize: 17, color: colors.placeholder, textAlign: "center" },
        categoryDescription: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.placeholder, textAlign: "center", marginTop: 4 },
        adBannerTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.baseContent, textAlign: "center", marginTop: 4 },
        // Visible/active on every unlocked category (not gated to one
        // specific category the way Media's own Watched-only toggle is) —
        // all 5 content categories respect ?type=movie|series.
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
        // it, starting flush under the tab bar with no gap.
        contentArea: { position: "relative" },
        glowWrap: { position: "absolute", left: 0, right: 0, top: 0, height: 140, alignItems: "center" },
        stepsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 14, paddingHorizontal: 16, paddingTop: 12 },
        listWrap: { paddingHorizontal: 10, marginTop: 18, gap: 2 },
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
            style={[styles.modeToggle, isLocked && styles.modeToggleHidden]}
            onPress={cycleMode}
            hitSlop={8}
            pointerEvents={isLocked ? "none" : "auto"}
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
                <PodiumSkeletonSlot key={rank} rank={rank} shape="poster" size={TEASER_POSTER_WIDTH[rank]} metricIcon={categoryMeta[selectedCategory].icon} />
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
                <LeaderboardCard key={item.content.id} rank={rank} content={item.content} basePath={basePath} metric={metricFor(selectedCategory, item)} />
              ))}
            </View>
            <View style={styles.listWrap}>
              {rest.map((item) => (
                <LeaderboardListRow key={item.content.id} rank={item.rank} content={item.content} basePath={basePath} metric={metricFor(selectedCategory, item)} />
              ))}
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
