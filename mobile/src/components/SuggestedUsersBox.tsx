import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFollowState } from "../hooks/useFollowState";
import type { SuggestedUser } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  users: SuggestedUser[];
}

// Non-scrollable, fixed-4-across replacement for the old horizontal-rail
// suggested-users insert (ContentRail + SuggestedUserCard.tsx, which is
// still used as-is elsewhere, e.g. network.tsx — its fixed 130px card
// width is exactly what made it unsuitable to reuse here, where up to 4
// need to fit side by side in one row). The user found the old rail bland
// and disliked it being scrollable — this is a self-contained module (its
// own darker `colors.base200` box against the feed's `base100`) instead of
// blending into the post stream.
export default function SuggestedUsersBox({ users }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: { backgroundColor: colors.base200, borderRadius: 16, padding: 12 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 10 },
        // A bit more breathing room between the 4 cells than the initial
        // pass (8 → 14) — the user's own ask.
        row: { flexDirection: "row", gap: 14 },
        cell: { flex: 1, alignItems: "center" },
        avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
        username: { fontFamily: fonts.bold, fontSize: 11, color: colors.baseContent, marginTop: 6, textAlign: "center" },
        mutual: { fontSize: 10, color: colors.placeholder, marginTop: 1, textAlign: "center" },
        followLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginTop: 6, paddingVertical: 2 },
      }),
    [colors]
  );

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t("Suggested Users")}</Text>
      <View style={styles.row}>
        {users.map((u) => (
          <Pressable key={u._id} style={styles.cell} onPress={() => router.push(`/user/${u._id}`)}>
            {u.profile_pic_url ? (
              <Image source={{ uri: u.profile_pic_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{u.username.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.username} numberOfLines={1}>
              {u.username}
            </Text>
            <Text style={styles.mutual} numberOfLines={1}>
              {t("mutual_count", { count: u.mutualCount })}
            </Text>
            <SuggestedFollowLabel userId={u._id} style={styles.followLabel} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Plain colored text instead of FollowButton's own bordered/filled button
// chrome — the user found buttons here too heavy for a 4-across compact
// grid; tapping just flips the label straight to "Following" via the same
// useFollowState hook FollowButton itself uses, no separate button shape
// needed. A distinct component (not inlined in the .map() above) since
// hooks can't be called from inside a callback.
function SuggestedFollowLabel({ userId, style }: { userId: string; style: TextStyle }) {
  const { t } = useTranslation();
  const { status, pending, follow, unfollow } = useFollowState(userId);

  if (status === "self") return null;

  const label = status === "following" ? t("Following") : status === "requested" ? t("Requested") : t("Follow");
  const onPress = () => (status === "not-following" ? follow() : unfollow());

  return (
    <Pressable onPress={onPress} disabled={pending} hitSlop={6}>
      <Text style={style}>{pending ? "…" : label}</Text>
    </Pressable>
  );
}
