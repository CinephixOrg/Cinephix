import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { ContentType } from "../../types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
const POSTER_WIDTH = 52;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

interface Props {
  id: string;
  type: ContentType;
  posterPath?: string | null;
  title: string;
  // Raw ISO date string (release_date/first_air_date) — only the year is
  // ever shown, extracted here rather than asking every caller to slice it.
  dateString?: string;
  basePath: "/search";
}

// Row layout replacing the old dense poster grid for Movies/Series search
// results — poster, title, and release year, one result per row. Matches
// the "scan a real list of results" read the row-based Lists/Reviews tabs
// already had, rather than a grid that only ever showed the poster itself.
export default function SearchContentRow({ id, type, posterPath, title, dateString, basePath }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const year = dateString ? dateString.slice(0, 4) : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
        poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 6, backgroundColor: colors.base200 },
        textCol: { flex: 1 },
        title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
        year: { fontSize: 12.5, color: colors.placeholder, marginTop: 3 },
      }),
    [colors]
  );

  return (
    <Pressable style={styles.row} onPress={() => router.push(`${basePath}/content/${type}/${id}` as any)}>
      {posterPath ? (
        <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {year && <Text style={styles.year}>{year}</Text>}
      </View>
    </Pressable>
  );
}
