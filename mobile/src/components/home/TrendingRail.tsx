import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getPopularThisWeek } from "../../api/feedService";
import ContentRail from "../ContentRail";
import AddedByCard from "../AddedByCard";
import type { ContentType, PopularThisWeekItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const MODE_CYCLE: ContentType[] = ["movie", "series"];

// TC-135 — replaces the old two permanently-visible "Trending Movies"/
// "Trending Series" rails with one rail + a movie/series toggle, mirroring
// LeaderboardPodium.tsx's own toggle exactly (same icons, same style, same
// "refetching overlay instead of remounting" fix for the same reason: a
// plain `loading` swap on every tap would lose scroll position and cause
// the title/data-just-shown mismatch bug already fixed there once).
export default function TrendingRail() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<ContentType>("movie");
  const [items, setItems] = useState<PopularThisWeekItem[]>([]);
  const [refetching, setRefetching] = useState(false);
  const didInitialLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (didInitialLoad.current) setRefetching(true);
    getPopularThisWeek(20, mode).then((res) => {
      if (cancelled) return;
      setItems(res);
      setRefetching(false);
      didInitialLoad.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const cycleMode = () => setMode((prev) => MODE_CYCLE[(MODE_CYCLE.indexOf(prev) + 1) % MODE_CYCLE.length]);

  const styles = StyleSheet.create({
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
      opacity: refetching ? 0.5 : 1,
    },
  });

  return (
    <ContentRail
      title={t("Trending")}
      data={items}
      keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
      emptyText={t("Nothing trending yet this week.")}
      renderItem={(item, index) => <AddedByCard item={item} rank={index + 1} />}
      headerRight={
        <Pressable style={styles.modeToggle} onPress={cycleMode} disabled={refetching} hitSlop={8}>
          <Ionicons name="film-outline" size={16} color={mode === "movie" ? colors.primary : colors.placeholder} />
          <Ionicons name="tv-outline" size={16} color={mode === "series" ? colors.primary : colors.placeholder} />
        </Pressable>
      }
    />
  );
}
