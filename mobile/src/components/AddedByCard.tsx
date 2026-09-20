import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
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
// and an "X added it" line, poster-only otherwise now (no title text under
// the poster, direct ask — "posterlerin altında isim yazmasın, sadece
// profil bilgisi olsun"). Used to also show a title, then before that
// Cinephix's own average-rating stars below the title (StarRatingDisplay,
// item.content.avgRating) — both removed per separate direct asks;
// item.content.avgRating itself is untouched in the type/data layer, just
// no longer rendered here. The add-count line
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
        // Widened + tightened spacing (was 84/marginRight:12) — direct ask,
        // enough that a 4th card sits about half-visible at the edge of a
        // normal phone width instead of the rail reading as 3-and-a-sliver.
        card: { width: 100, marginRight: 8 },
        posterWrap: { position: "relative" },
        // Thin gray border, direct ask — same colors.border every other
        // plain content-box frame in this app already uses. Radius matched
        // to MiniContentCard.tsx's own poster (4, not this card's previous
        // 8) — direct ask to make Trending/Friends' Choice's card chrome
        // read identically to What to Watch's, no inconsistency between
        // Discover's own rails.
        poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 4, backgroundColor: colors.base200, borderWidth: 1, borderColor: colors.border },
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
