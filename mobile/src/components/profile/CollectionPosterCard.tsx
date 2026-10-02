import { memo, useMemo } from "react";
import { View, Text, Image, StyleSheet, type ViewStyle } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CollectionItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  item: CollectionItem;
  basePath: `/user/${string}` | "/profile";
  style?: ViewStyle;
}

// One title in a watched list / watchlist rail. Deliberately not
// FavoriteCard: that one prints the owner's rating under the poster instead
// of the title, which suits a curated five-item pick but not a browsing list
// of dozens, where the title is what you're actually scanning for.
function CollectionPosterCard({ item, basePath, style }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => router.push(`${basePath}/content/${item.itemType}/${item.itemId}` as never)}
    >
      {item.poster_path ? (
        <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterEmpty]}>
          <Ionicons
            name={item.itemType === "series" ? "tv-outline" : "film-outline"}
            size={22}
            color={colors.placeholder}
          />
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: { width: "100%" },
    poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: colors.base200 },
    posterEmpty: { alignItems: "center", justifyContent: "center" },
    title: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 6, textAlign: "center" },
  });
}

export default memo(CollectionPosterCard);
