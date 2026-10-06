import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getGroupChallengeDetail } from "../api/groupService";
import type { GroupChallengeDetail, GroupChallengeMemberProgress } from "../types";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
const GRID_COLUMNS = 6;
const GRID_GAP = 5;
const CONTENT_PADDING_X = 16;

function itemKey(itemType: string, itemId: string) {
  return `${itemType}:${itemId}`;
}

// The full breakdown behind the Overview card's own progress bar — direct
// ask, after the card alone "hiç bilgi sunmuyor... kim neyi izlemiş kaç
// tane izlemiş." The poster grid up top always shows ONE member's
// progress at a time (yours, by default) — watched titles full opacity,
// the rest dimmed; tapping a different member below swaps whose progress
// it's showing, replacing a separate per-row dot breakdown entirely.
//
// "Completed" = watched (User.watchlist, despite the name), not rated —
// see groupController.js's getGroupChallenge/getGroupChallengeDetail for
// why: rating always implies watched, but watched doesn't require a
// rating, and the original Rating-only version under-counted exactly
// that case.
export default function ChallengeDetailScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [challenge, setChallenge] = useState<GroupChallengeDetail | null | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!slug) return;
    getGroupChallengeDetail(slug)
      .then((c) => {
        setChallenge(c);
        // Defaults to the viewer's own progress the first time this
        // loads; stays on whoever's selected across a refresh otherwise.
        setSelectedUserId((current) => current ?? user?._id ?? c?.members[0]?.user._id ?? null);
      })
      .catch(() => setChallenge(null));
  }, [slug, user?._id]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("Challenge") });
  }, [navigation, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        content: { padding: 16, gap: 22, paddingBottom: 40 },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        title: { flex: 1, fontFamily: fonts.extrabold, fontSize: 20, color: colors.baseContent },
        endedBadge: { backgroundColor: colors.base300, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
        endedBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.placeholder },
        meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        sectionTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.baseContent },
        sectionSubtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, marginTop: 2 },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
        poster: { borderRadius: 6, backgroundColor: colors.base300, overflow: "hidden" },
        memberCard: { backgroundColor: colors.base200, borderRadius: 14, overflow: "hidden" },
        memberRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
        memberRowSelected: { backgroundColor: `${colors.primary}14` },
        memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.base300 },
        memberInfo: { flex: 1, minWidth: 0 },
        memberName: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        memberFraction: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder, marginTop: 2 },
        memberProgressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.base300, overflow: "hidden", marginTop: 6 },
        memberProgressFill: { height: 6, borderRadius: 3 },
        memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        completeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: `${colors.success}22` },
        completeBadgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.success },
      }),
    [colors]
  );

  if (challenge === undefined) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!challenge) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.meta}>{t("No active challenge")}</Text>
      </View>
    );
  }

  const accent = colors.primary;
  const selectedMember = challenge.members.find((m) => m.user._id === selectedUserId) ?? null;
  const selectedKeys = new Set(selectedMember?.completedItemKeys ?? []);
  const isSelf = selectedUserId === user?._id;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{challenge.title}</Text>
          {challenge.isExpired ? (
            <View style={styles.endedBadge}>
              <Text style={styles.endedBadgeText}>{t("Ended").toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta}>
          {challenge.isExpired
            ? t("Ended {{date}}", { date: new Date(challenge.deadline).toLocaleDateString(undefined, { month: "long", day: "numeric" }) })
            : t("Ends {{date}}", { date: new Date(challenge.deadline).toLocaleDateString(undefined, { month: "long", day: "numeric" }) })}
          {" · "}
          {t("{{count}} finished", { count: challenge.completedCount })}
        </Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>{t("{{count}} titles", { count: challenge.total })}</Text>
        <Text style={styles.sectionSubtitle}>
          {isSelf ? t("Your progress") : t("{{username}}'s progress", { username: selectedMember?.user.username ?? "" })}
          {" · "}
          {t("{{done}}/{{total}}", { done: selectedMember?.completedCount ?? 0, total: challenge.total })}
        </Text>
        <GridOfPosters challenge={challenge} doneKeys={selectedKeys} styles={styles} />
      </View>

      <View>
        <Text style={styles.sectionTitle}>{t("Member Progress")}</Text>
        <View style={styles.memberCard}>
          {challenge.members.map((member, i) => (
            <MemberRow
              key={member.user._id}
              member={member}
              total={challenge.total}
              accent={accent}
              divider={i > 0}
              selected={member.user._id === selectedUserId}
              isSelf={member.user._id === user?._id}
              onPress={() => setSelectedUserId(member.user._id)}
              styles={styles}
              colors={colors}
              t={t}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function GridOfPosters({ challenge, doneKeys, styles }: { challenge: GroupChallengeDetail; doneKeys: Set<string>; styles: any }) {
  const { width: screenWidth } = useWindowDimensions();
  // Pixel widths, not percentages — a percentage column alongside a real
  // `gap` overflows the row (each child still claims a full 1/6 of the
  // container, then gap adds more on top), same fix every other fixed-
  // column grid in this app already uses (ListEditorParts' AddedGrid).
  const tileWidth = Math.floor((screenWidth - CONTENT_PADDING_X * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  return (
    <View style={[styles.grid, { marginTop: 10 }]}>
      {challenge.items.map((item) => {
        const key = itemKey(item.itemType, item.itemId);
        const watched = doneKeys.has(key);
        return (
          <View
            key={key}
            style={[
              styles.poster,
              {
                width: tileWidth,
                height: tileWidth * 1.5,
                opacity: watched ? 1 : 0.3,
              },
            ]}
          >
            {item.posterUrl ? <Image source={{ uri: `${POSTER_BASE}${item.posterUrl}` }} style={StyleSheet.absoluteFill} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function MemberRow({
  member,
  total,
  accent,
  divider,
  selected,
  isSelf,
  onPress,
  styles,
  colors,
  t,
}: {
  member: GroupChallengeMemberProgress;
  total: number;
  accent: string;
  divider: boolean;
  selected: boolean;
  isSelf: boolean;
  onPress: () => void;
  styles: any;
  colors: any;
  t: (key: string, opts?: any) => string;
}) {
  const pct = Math.min(100, Math.round((member.completedCount / Math.max(1, total)) * 100));
  const isComplete = member.completedCount >= total;

  return (
    <Pressable
      style={[styles.memberRow, divider && styles.memberDivider, selected && styles.memberRowSelected]}
      onPress={onPress}
    >
      {member.user.profile_pic_url ? (
        <Image source={{ uri: member.user.profile_pic_url }} style={styles.memberAvatar} />
      ) : (
        <View style={styles.memberAvatar} />
      )}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.user.username}
          {isSelf ? ` ${t("(you)")}` : ""}
        </Text>
        <Text style={styles.memberFraction}>{t("{{done}}/{{total}}", { done: member.completedCount, total })}</Text>
        <View style={styles.memberProgressTrack}>
          <View style={[styles.memberProgressFill, { width: `${pct}%`, backgroundColor: accent }]} />
        </View>
      </View>
      {isComplete ? (
        <View style={styles.completeBadge}>
          <Text style={styles.completeBadgeText}>{t("Done")}</Text>
        </View>
      ) : null}
      <Ionicons name={selected ? "eye" : "eye-outline"} size={16} color={selected ? accent : colors.placeholder} />
    </Pressable>
  );
}
