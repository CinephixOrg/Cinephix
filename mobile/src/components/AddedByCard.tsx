import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import StackedAvatars from "./StackedAvatars";
import type { PopularThisWeekItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  item: PopularThisWeekItem;
  // This item's position in the rail (1-based) — a Netflix-Top-10-style
  // rank badge, not a separate ranking concept of its own; reuses the
  // list's own already-sorted-by-addCount order.
  rank: number;
}

// Trending Movies/Series/Friends' Choice rail card — poster, rank badge,
// title, and an "X added it" line. Used to also show Cinephix's own
// average-rating stars below the title (StarRatingDisplay, item.content.
// avgRating) — removed per direct ask; item.content.avgRating itself is
// untouched in the type/data layer, just no longer rendered here. The
// add-count line
// always shows when addCount>0 (every item here has one, since that's what
// ranked it into the list) — avatars layer on top when topAdders resolved,
// but previously the whole line (count included) was hidden whenever
// topAdders came back empty, silently dropping real engagement data.
export default function AddedByCard({ item, rank }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // 84 matches PosterRow.tsx's own established rail-poster width
        // elsewhere in the app (was 120 — notably larger than every other
        // rail/thumbnail size in the codebase: PosterRow 84, MyListCard 56,
        // ShareCard's sharePoster 64).
        card: { width: 84, marginRight: 12 },
        posterWrap: { position: "relative" },
        poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.base200 },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 12 },
        rankBadge: {
          position: "absolute",
          top: 4,
          left: 4,
          minWidth: 20,
          height: 20,
          paddingHorizontal: 5,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.65)",
          alignItems: "center",
          justifyContent: "center",
        },
        rankBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.bold },
        title: { marginTop: 6, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        footer: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
        count: { fontSize: 11, color: colors.placeholder, flexShrink: 1 },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push(`/home/content/${item.content.type}/${item.content.id}` as any)}>
        <View style={styles.posterWrap}>
          {item.content.poster_path ? (
            <Image source={{ uri: `${POSTER_BASE}${item.content.poster_path}` }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterFallbackText}>{t("No image")}</Text>
            </View>
          )}
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{rank}</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.content.title}
        </Text>
      </Pressable>
      {item.addCount > 0 && (
        <View style={styles.footer}>
          {item.topAdders && item.topAdders.length > 0 ? (
            <StackedAvatars users={item.topAdders} size={18} />
          ) : (
            <Ionicons name="bookmark" size={13} color={colors.placeholder} />
          )}
          <Text style={styles.count} numberOfLines={1}>
            {t("added_count", { count: item.addCount })}
          </Text>
        </View>
      )}
    </View>
  );
}
