import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import DiscoverListCard from "./DiscoverListCard";
import PeoplePodiumCard from "./PeoplePodiumCard";
import FadingMemberAvatars from "./FadingMemberAvatars";
import CommunityTags from "./socials/CommunityTags";
import { categoryTone, isDarkTheme } from "./socials/communityCategory";
import type { CommunityRailItem, GroupAnnouncement } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const POSTER_WIDTH = 64;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
// Shared by every card except "list" (which renders the real
// DiscoverListCard verbatim, at its own natural height) — generous enough
// for the tallest of the others (the challenge poster grid), so shorter
// bodies (watch party, podium) just center inside it instead of every
// card fighting its own content for a different height.
const CARD_HEIGHT = 232;

interface Props {
  item: CommunityRailItem;
}

// Reorders a rank-1..3 list into podium display order (2nd, 1st, 3rd) —
// same helper as PeoplePodium.tsx's own toPodiumOrder, copied locally
// rather than imported (small, one-off, matches this app's own
// established convention for this kind of helper).
function toPodiumOrder<T>(items: T[]): { item: T; rank: 1 | 2 | 3 }[] {
  if (items.length < 3) return items.map((item, i) => ({ item, rank: (i + 1) as 1 | 2 | 3 }));
  return [
    { item: items[1], rank: 2 as const },
    { item: items[0], rank: 1 as const },
    { item: items[2], rank: 3 as const },
  ];
}

// One card in Discover's "Community Announcements" rail
// (CommunityAnnouncementsSwiper.tsx) — either an actual community event
// (member-only — new challenge, scheduled watch party, new list, weekly
// leaderboard result) or a "popular community" discovery card (shown to
// everyone, so communities stay discoverable without leaking their
// internal event stream to non-members). Each category deliberately
// mirrors its own canonical design elsewhere in the app (the challenge
// poster grid from Overview, the real DiscoverListCard for a list, a
// proper 1st-centered podium for the leaderboard) rather than a bespoke
// simplified one, direct ask. Every announcement destination is a
// Home-nested route (not the raw /socials/communities/... one) so Back
// returns to this rail instead of crossing into the Socials tab's own
// stack — same reasoning as CurrentlyWatchingCard.tsx's own watch-party
// link.
export default function CommunityRailCard({ item }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const dark = isDarkTheme(colors);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { height: CARD_HEIGHT, backgroundColor: colors.base200, borderRadius: 16, padding: 14, gap: 10 },
        identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        communityTile: { width: 26, height: 26, borderRadius: 7, backgroundColor: colors.base300, alignItems: "center", justifyContent: "center", overflow: "hidden" },
        nameAndCategory: { flex: 1, minWidth: 0 },
        communityName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
        categoryInline: { fontFamily: fonts.italic, fontSize: 12 },
        categoryBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
        categoryText: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        joinBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
        joinedBadge: { backgroundColor: `${colors.primary}1F` },
        joinBadgeOutline: { borderWidth: 1, borderColor: colors.border },
        joinBadgeText: { fontFamily: fonts.bold, fontSize: 11.5 },
        bodyWrap: { flex: 1, justifyContent: "center" },
        body: { flexDirection: "row", alignItems: "center", gap: 12 },
        poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 8, backgroundColor: colors.base300, overflow: "hidden" },
        posterImage: { ...StyleSheet.absoluteFill, borderRadius: 8 },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        textCol: { flex: 1, gap: 4, minWidth: 0 },
        title: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
        // Challenge — same grid Overview's own challenge card shows
        // (CommunityHubTab.tsx's challengePosterGrid/challengePosterTile).
        challengeTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, marginBottom: 6 },
        challengeGrid: { flexDirection: "row", gap: 4 },
        challengeTile: { flex: 1, aspectRatio: 2 / 3, borderRadius: 6, backgroundColor: colors.base300, overflow: "hidden" },
        challengeMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, marginTop: 6 },
        // Leaderboard — a proper podium (PeoplePodiumCard), 1st centered
        // and bigger, same as the app's own Media/Discover podiums.
        podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10 },
        // Popular community card
        description: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.placeholder },
        avatarsWrap: { marginTop: 6 },
        membersText: { fontFamily: fonts.bold, fontSize: 12, color: colors.baseContent, textAlign: "center", marginTop: 6 },
        hashtagsWrap: { marginTop: 8 },
      }),
    [colors]
  );

  if (item.kind === "popular") {
    const group = item.data;
    const tone = categoryTone(group.category, dark);
    const members = t(group.memberCount === 1 ? "{{count}} member" : "{{count}} members", { count: group.memberCount });

    return (
      <Pressable style={styles.card} onPress={() => router.push(`/socials/communities/${group.slug}` as any)}>
        <View style={styles.identityRow}>
          <View style={styles.communityTile}>
            {group.coverImage ? <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Ionicons name={tone.icon} size={14} color={tone.color} />}
          </View>
          <Text style={styles.nameAndCategory} numberOfLines={1}>
            <Text style={styles.communityName}>{group.name}</Text>
            <Text style={[styles.categoryInline, { color: tone.color }]}> · {t(group.category)}</Text>
          </Text>
          <View style={[styles.joinBadge, group.isMember ? styles.joinedBadge : styles.joinBadgeOutline]}>
            {group.isMember ? <Ionicons name="checkmark-circle" size={12} color={colors.primary} /> : null}
            <Text style={[styles.joinBadgeText, { color: group.isMember ? colors.primary : colors.placeholder }]}>{group.isMember ? t("Joined") : t("Join")}</Text>
          </View>
        </View>

        <View style={styles.bodyWrap}>
          {group.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {group.description}
            </Text>
          ) : null}
          {group.previewMembers && group.previewMembers.length > 0 ? (
            <View style={styles.avatarsWrap}>
              <FadingMemberAvatars members={group.previewMembers} />
            </View>
          ) : null}
          <Text style={styles.membersText}>{members}</Text>
          {group.tags.length > 0 ? (
            <View style={styles.hashtagsWrap}>
              <CommunityTags tags={group.tags} tone={tone} limit={4} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const announcement = item.data;
  const { group, category } = announcement;

  if (category === "list" && announcement.listData) {
    const listData = announcement.listData;
    return (
      <DiscoverListCard
        list={{
          _id: announcement._id,
          owner: null,
          name: listData.name,
          description: listData.description,
          isPublic: true,
          items: new Array(listData.itemCount).fill(null) as never,
          previewItems: listData.previewItems,
          likeCount: 0,
          views: 0,
          createdAt: announcement.createdAt,
          updatedAt: announcement.createdAt,
        }}
        communityIdentity={{ name: group.name, coverImage: group.coverImage }}
        basePath="/home"
        onPress={() => announcement.listId && router.push(`/home/lists/${announcement.listId}` as any)}
      />
    );
  }

  const handlePress = () => {
    if (category === "challenge") router.push(`/home/community-challenge/${group.slug}` as any);
    else if (category === "leaderboard") router.push(`/home/community-leaderboard/${group.slug}` as any);
    else if (category === "watchparty" && announcement.partyId) router.push(`/home/watch-party/${announcement.partyId}?slug=${group.slug}` as any);
  };

  const categoryLabel =
    category === "challenge" ? t("New Challenge") : category === "watchparty" ? t("New Watch Party") : t("This Week's Leaderboard");
  const categoryIcon = category === "challenge" ? "trophy" : category === "watchparty" ? "calendar" : "podium";

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.identityRow}>
        <View style={styles.communityTile}>
          {group.coverImage ? <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Ionicons name="people" size={14} color={colors.placeholder} />}
        </View>
        <Text style={styles.communityName} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={styles.categoryBadge}>
          <Ionicons name={categoryIcon} size={12} color={colors.placeholder} />
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>
      </View>

      <View style={styles.bodyWrap}>
        {category === "challenge" ? (
          <View>
            <Text style={styles.challengeTitle} numberOfLines={1}>
              {announcement.title}
            </Text>
            <View style={styles.challengeGrid}>
              {(announcement.posterUrls ?? []).slice(0, 4).map((posterUrl, i) => (
                <View key={i} style={styles.challengeTile}>
                  {posterUrl ? <Image source={{ uri: `${POSTER_BASE}${posterUrl}` }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                </View>
              ))}
            </View>
            {announcement.itemCount != null ? <Text style={styles.challengeMeta}>{t("{{count}} titles", { count: announcement.itemCount })}</Text> : null}
          </View>
        ) : category === "leaderboard" ? (
          <View style={styles.podiumRow}>
            {toPodiumOrder(announcement.leaderboardTop ?? []).map(({ item: entry, rank }) => (
              <PeoplePodiumCard
                key={entry.user}
                rank={rank}
                user={{ id: entry.user, username: entry.username, profile_pic_url: entry.profilePicUrl ?? undefined }}
                metric={{ kind: "score", count: entry.score }}
              />
            ))}
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.poster}>
              {announcement.posterUrl ? (
                <Image source={{ uri: `${POSTER_BASE}${announcement.posterUrl}` }} style={styles.posterImage} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.posterFallback]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.placeholder} />
                </View>
              )}
            </View>
            <View style={styles.textCol}>
              <Text style={styles.title} numberOfLines={2}>
                {announcement.title}
              </Text>
              {announcement.scheduledAt ? (
                <Text style={styles.meta}>
                  {new Date(announcement.scheduledAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
