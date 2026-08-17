import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import StackedAvatars from "./StackedAvatars";
import type { PopularThisWeekItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  item: PopularThisWeekItem;
}

// Popular This Week / Popular with Friends rail card — poster, title, and
// who added it (no rating, deliberately, per the user's design: this rail
// is about watchlist-add activity, not rating). Doesn't compose ContentCard
// — its meta line always falls back to a bare "—" when no year is supplied
// (these items don't have one), which read as a stray line under the
// title — inlining the poster/title here instead just omits that line.
export default function AddedByCard({ item }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { width: 120, marginRight: 12 },
        poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.base200 },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 12 },
        title: { marginTop: 6, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        footer: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
        count: { fontSize: 11, color: colors.placeholder, flexShrink: 1 },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push(`/home/content/${item.content.type}/${item.content.id}` as any)}>
        {item.content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${item.content.poster_path}` }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={styles.posterFallbackText}>{t("No image")}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {item.content.title}
        </Text>
      </Pressable>
      {item.topAdders && item.topAdders.length > 0 && (
        <View style={styles.footer}>
          <StackedAvatars users={item.topAdders} size={18} />
          <Text style={styles.count} numberOfLines={1}>
            {t("added_count", { count: item.addCount })}
          </Text>
        </View>
      )}
    </View>
  );
}
