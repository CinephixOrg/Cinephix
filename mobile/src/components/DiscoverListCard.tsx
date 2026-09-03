import { useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { CASCADE_POSTER_RADIUS } from "./PosterCascade";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
// Same ratio as ShareCard.tsx's own list-post film strip (56 × 56*1.5),
// reused verbatim rather than re-derived, per direct ask that this page's
// list cards should look like that exact strip.
const FILM_STRIP_POSTER_WIDTH = 56;
const FILM_STRIP_POSTER_HEIGHT = FILM_STRIP_POSTER_WIDTH * 1.5;

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
  // Widened from the original "/home" | "/search" (this card's only two
  // callers at the time) so ContentListsSection.tsx can reuse it from any
  // of the 8 tabs Content Detail is duplicated into — same broader set
  // ContentCard.tsx already uses for the same reason.
  basePath: "/home" | "/search" | "/socials" | "/watchlist" | "/to-watch" | "/lists" | "/profile" | `/user/${string}`;
}

// Vertical list-preview card, backing both "Lists from Friends" and
// "Popular Lists" — same design for both, per the user's explicit ask.
// Owner avatar+username sit top-right (reversed from this card's earlier
// top-left layout); below that, a flush "film strip" of preview posters —
// same look as ShareCard.tsx's own list-post box (zero-gap, square-cornered
// thumbnails, only the strip's outer ends rounded, thin colors.border
// frame), reused directly rather than this card's earlier gapped/
// individually-rounded poster row, per direct ask; description last. The
// static "Following" badge that used to sit here (marking list.fromFollowing)
// was removed per direct ask — list.fromFollowing itself is untouched and
// still drives ListsSection.tsx's own "Lists from Friends" filtering,
// only this card's own visual badge is gone.
export default function DiscoverListCard({ list, onPress, basePath }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.base200,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    ownerName: { fontSize: 12, color: colors.placeholder },
    avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.base300 },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primary },
    filmStripContainer: { marginTop: 10, borderRadius: CASCADE_POSTER_RADIUS, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    filmStripPoster: { width: FILM_STRIP_POSTER_WIDTH, height: FILM_STRIP_POSTER_HEIGHT, backgroundColor: colors.base300, overflow: "hidden" },
    filmStripFallback: { alignItems: "center", justifyContent: "center" },
    filmStripFallbackText: { color: colors.placeholder, fontSize: 9, textAlign: "center", paddingHorizontal: 3 },
    description: { fontSize: 12, color: colors.baseContent, marginTop: 10, lineHeight: 16 },
    count: { fontSize: 11, color: colors.placeholder, marginTop: 8 },
  }), [colors]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name}
        </Text>
        <View style={styles.ownerRow}>
          <Text style={styles.ownerName} numberOfLines={1}>
            {list.owner.username}
          </Text>
          {list.owner.profile_pic_url ? (
            <Image source={{ uri: list.owner.profile_pic_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{list.owner.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {list.previewItems.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmStripContainer}>
          {list.previewItems.map((item) => (
            <Pressable
              key={`${item.itemType}-${item.itemId}`}
              style={styles.filmStripPoster}
              onPress={() => router.push(`${basePath}/content/${item.itemType}/${item.itemId}` as any)}
            >
              {item.poster_path ? (
                <Image source={{ uri: `${POSTER_BASE}${item.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.filmStripFallback]}>
                  <Text style={styles.filmStripFallbackText} numberOfLines={3}>
                    {item.title}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {list.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {list.description}
        </Text>
      ) : null}

      <Text style={styles.count}>{t("item_count", { count: list.items.length })}</Text>
    </Pressable>
  );
}
