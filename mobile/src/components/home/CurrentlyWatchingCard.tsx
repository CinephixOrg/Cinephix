import { useMemo } from "react";
import { View, Text, Image, StyleSheet, type ViewStyle } from "react-native";
import Pressable from "../common/TapSafePressable";
import LiveBadge from "../common/LiveBadge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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

// One card in Shares' "Currently Watching" rail — either a person's own
// status, or a community's live watch party (direct ask to integrate
// rather than build a second rail). Both share the same silhouette (a
// tilted poster riding under a bigger "who" element, name, then a status
// line) so the watch-party card reads as a member of the same family, not
// a bolted-on different thing — only the "who" (avatar vs. community
// identity) and the status line (time-ago vs. "LIVE") actually differ.
export default function CurrentlyWatchingCard({ item, basePath, style }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const accent = item.kind === "watchparty" ? item.group.accentColor || colors.primary : colors.primary;
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
        communityTile: { backgroundColor: `${accent}22`, alignItems: "center", justifyContent: "center" },
        username: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.baseContent, textAlign: "center", marginTop: 4 },
        timeAgo: { fontSize: 10, color: colors.placeholder, textAlign: "center", marginTop: 1 },
        liveRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
        liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: accent },
        liveText: { fontSize: 9.5, fontFamily: fonts.bold, color: accent, letterSpacing: 0.3 },
      }),
    [colors, accent]
  );

  const onPress =
    item.kind === "watchparty"
      // Nested under Home's own stack (home/watch-party/[id].tsx), not
      // the community-nested route — real bug, reported live:
      // `withAnchor` only guarantees *some* back target exists (whatever
      // the destination tab's own root happens to be — Messages, here),
      // not that it's actually this feed. This stays in the same stack,
      // so Back genuinely returns here.
      ? () => router.push(`/home/watch-party/${item.partyId}?slug=${item.group.slug}` as never)
      : () => router.push(`${basePath}/content/${item.contentType}/${item.contentId}` as any);

  return (
    <Pressable style={[styles.card, style]} onPress={onPress}>
      <View style={styles.stack}>
        {item.posterUrl ? <Image source={{ uri: `${POSTER_BASE}${item.posterUrl}` }} style={styles.poster} /> : <View style={styles.poster} />}
        <View style={styles.avatarRing}>
          {item.kind === "watchparty" ? (
            item.group.coverImage ? (
              <Image source={{ uri: item.group.coverImage }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
            ) : (
              <View style={[styles.communityTile, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}>
                <Ionicons name="people" size={20} color={accent} />
              </View>
            )
          ) : (
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
          )}
        </View>
      </View>
      <Text style={styles.username} numberOfLines={1}>
        {item.kind === "watchparty" ? item.group.name : item.user.username}
      </Text>
      {item.kind === "watchparty" ? (
        <LiveBadge label={t("LIVE")} dotStyle={styles.liveDot} textStyle={styles.liveText} containerStyle={styles.liveRow} />
      ) : (
        <Text style={styles.timeAgo}>{timeAgo(item.startedAt)}</Text>
      )}
    </Pressable>
  );
}
