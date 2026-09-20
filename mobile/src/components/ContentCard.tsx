import { useMemo } from "react";
import { View, Text, Image, StyleSheet, ViewStyle } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  id: string;
  type: ContentType;
  title: string;
  posterPath?: string | null;
  year?: string;
  voteAverage?: number;
  // Overrides the default 48% width — pass { width: "100%" } when already
  // wrapped in a parent that controls the 48% column width itself (e.g.
  // lists/[id].tsx, which needs its own wrapper for a remove-item button).
  style?: ViewStyle;
  // Which tab's own nested content/[type]/[id] route to push to (e.g.
  // "/watchlist", "/lists") — content detail is duplicated into every tab's
  // own Stack (see (app)/_layout.tsx) so back navigation returns to the
  // right tab instead of bottom-tabs' default of jumping to the first one.
  basePath: "/watchlist" | "/to-watch" | "/lists" | "/home" | "/profile" | `/user/${string}`;
}

export default function ContentCard({
  id,
  type,
  title,
  posterPath,
  year,
  voteAverage,
  style,
  basePath,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: { width: "48%", marginBottom: 16 },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 8,
    backgroundColor: colors.base200,
  },
  posterFallback: { alignItems: "center", justifyContent: "center" },
  posterFallbackText: { color: colors.placeholder, fontSize: 12 },
  title: { marginTop: 6, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
  meta: { color: colors.placeholder, fontSize: 12, marginTop: 2 },
}), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => router.push(`${basePath}/content/${type}/${id}` as any)}
    >
      {posterPath ? (
        <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={styles.posterFallbackText}>{t("No image")}</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.meta}>
        {year || "—"}
        {voteAverage ? `  ★ ${voteAverage.toFixed(1)}` : ""}
      </Text>
    </Pressable>
  );
}

