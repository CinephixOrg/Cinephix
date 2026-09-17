import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import TierAvatarFrame from "../TierAvatarFrame";
import type { CurrentlyWatchingFeedItem } from "../../api/feedService";
import { timeAgo } from "../../utils/timeAgo";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
const POSTER_WIDTH = 48;
const AVATAR_SIZE = 44;
const STACK_HEIGHT = 92;
const CARD_WIDTH = 88;

interface Props {
  item: CurrentlyWatchingFeedItem;
  basePath: "/home" | "/socials";
  style?: ViewStyle;
}

// One card in Discover's "Currently Watching" rail — the WATCHER, not the
// poster, is the dominant visual now (the avatar is the biggest element,
// front and center), direct correction after the first version read as a
// near-duplicate of Trending's own poster-forward cards and didn't stand
// out as a different kind of section. The poster shrinks to a small,
// tilted accent riding UNDER the avatar's bottom-right corner instead —
// same tilted-sticker technique ShareCard.tsx's own like/watchlist
// stickers use (a bare `rotate` transform, no extra library), just
// applied to the poster here rather than to a heart/plus glyph. A plain
// colors.base100 ring behind the avatar is what actually separates it
// visually from the poster underneath (without it the two art pieces
// would visually merge at the overlap edge).
export default function CurrentlyWatchingCard({ item, basePath, style }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { width: CARD_WIDTH, alignItems: "center" },
        stack: { width: CARD_WIDTH - 12, height: STACK_HEIGHT },
        poster: {
          position: "absolute",
          top: 6,
          left: 4,
          width: POSTER_WIDTH,
          aspectRatio: 2 / 3,
          borderRadius: 6,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
          transform: [{ rotate: "-8deg" }],
        },
        avatarRing: {
          position: "absolute",
          bottom: 4,
          right: 0,
          padding: 2.5,
          borderRadius: (AVATAR_SIZE + 5) / 2,
          backgroundColor: colors.base100,
        },
        avatarFallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
        username: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.baseContent, textAlign: "center", marginTop: 4 },
        timeAgo: { fontSize: 10, color: colors.placeholder, textAlign: "center", marginTop: 1 },
      }),
    [colors]
  );

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => router.push(`${basePath}/content/${item.contentType}/${item.contentId}` as any)}
    >
      <View style={styles.stack}>
        {item.posterUrl ? (
          <Image source={{ uri: `${POSTER_BASE}${item.posterUrl}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        )}
        <View style={styles.avatarRing}>
          <TierAvatarFrame tier={item.user.accountTier} size={AVATAR_SIZE}>
            {(innerSize) =>
              item.user.profile_pic_url ? (
                <Image source={{ uri: item.user.profile_pic_url }} style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }} />
              ) : (
                <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                  <Text style={styles.avatarFallbackText}>{item.user.username.slice(0, 2).toUpperCase()}</Text>
                </View>
              )
            }
          </TierAvatarFrame>
        </View>
      </View>
      <Text style={styles.username} numberOfLines={1}>
        {item.user.username}
      </Text>
      <Text style={styles.timeAgo}>{timeAgo(item.startedAt)}</Text>
    </Pressable>
  );
}
