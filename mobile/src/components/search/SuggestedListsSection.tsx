import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getSuggestedLists } from "../../api/listService";
import SearchListCard from "./SearchListCard";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POOL_SIZE = 20;
const PICK_COUNT = 3;

function sampleFew(pool: DiscoverListItem[]): DiscoverListItem[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, PICK_COUNT);
}

// Fills Search's Lists tab empty state — direct ask, same "you might be
// interested" idea as SuggestedForYouGrid/this tab's Reviews sibling, but
// its own algorithm: public lists that actually CONTAIN something the
// viewer has already watched (customListRoute.js's /suggested), not just
// generally popular ones. A pool of matching lists comes back from the
// server; a fresh few of it are sampled client-side each time this mounts
// (same reasoning as SuggestedForYouGrid), so revisiting this tab doesn't
// always show the identical 3.
export default function SuggestedListsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [picked, setPicked] = useState<DiscoverListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSuggestedLists()
      .then((pool) => {
        if (!cancelled) setPicked(sampleFew(pool.slice(0, POOL_SIZE)));
      })
      .catch(() => {
        if (!cancelled) setPicked([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", paddingTop: 16 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 4, paddingHorizontal: 20 },
      }),
    [colors]
  );

  if (!picked || picked.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("You might be interested")}</Text>
      {picked.map((list) => (
        <SearchListCard key={list._id} list={list} onPress={() => router.push(`/search/lists/${list._id}` as any)} basePath="/search" />
      ))}
    </View>
  );
}
