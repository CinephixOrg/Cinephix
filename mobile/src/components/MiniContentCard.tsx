import { useMemo } from "react";
import { View, Image, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  id: string;
  type: ContentType;
  posterPath?: string | null;
  // Optional — List Detail's grid deliberately omits it (poster-only, by
  // design); Search's Films/Series grid passes it since browsing by title
  // matters more there than in an already-curated list.
  title?: string;
  // `/user/<id>` included so a list opened from someone's public profile
  // pushes content inside that profile's own stack, keeping Back pointed at
  // the list you came from rather than jumping tabs.
  basePath: "/lists" | "/home" | "/search" | "/profile" | "/watchlist" | "/to-watch" | `/user/${string}`;
  onRemove?: () => void;
  // Explicit pixel width + spacing from the grid (fixed values computed by
  // the caller from screen width) rather than a percentage — keeps the gap
  // between cards constant regardless of how many items land in the last,
  // possibly-incomplete row.
  style?: ViewStyle;
}

// Small card for dense grids (List Detail's 6-per-row, Search's 5-per-row)
// — poster-only unless a title is passed.
export default function MiniContentCard({ id, type, posterPath, title, basePath, onRemove, style }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Thin gray border, direct ask — matches the same colors.border
        // frame AddedByCard.tsx's own poster already uses (Trending/
        // Friends' Choice), so all of Discover's poster cards read as one
        // consistent design rather than this one being the odd one out.
        poster: {
          width: "100%",
          aspectRatio: 2 / 3,
          borderRadius: 4,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        removeButton: {
          position: "absolute",
          top: 2,
          right: 2,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
        },
        title: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 4, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <View style={style}>
      <Pressable onPress={() => router.push(`${basePath}/content/${type}/${id}` as any)}>
        {posterPath ? (
          <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        )}
        {onRemove && (
          <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={6}>
            <Ionicons name="close" size={11} color="#fff" />
          </Pressable>
        )}
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
