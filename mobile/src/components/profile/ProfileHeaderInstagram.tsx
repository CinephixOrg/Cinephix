import { useMemo, type ReactElement } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  profile: UserProfile;
  // Present only when this header is showing someone ELSE's profile — the
  // Followers/Following stats need to route to that user's network, not
  // "your own" (own-profile omits this and gets the simple self-scoped push).
  targetUserId?: string;
  // Rendered as the last element (below the tier badge/joined-date row) —
  // e.g. Public Profile's Follow button + Cinematch panel, positioned
  // directly above whatever category-tab row the caller renders next.
  actionsSlot?: ReactElement | null;
  // Own-profile only — Instagram-style 3rd stat (Posts/Followers/Following).
  // Not interactive (no dedicated "all shares" screen to route to beyond
  // the Your Sharings category tab, which already lives one scroll away).
  shareCount?: number;
}

// Instagram-style header: avatar left, username + follower/following stats
// right. The avatar (84px) is intentionally a bit taller than the right
// column's natural stacked height (username line + stats row), so the
// stats block's bottom lands a few px above the avatar's own bottom with
// no absolute-position math — stays correct across font-scaling too.
export default function ProfileHeaderInstagram({ profile, targetUserId, actionsSlot, shareCount }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const goToNetwork = (tab: "followers" | "following") => {
    if (targetUserId) {
      router.push({ pathname: "/network", params: { userId: targetUserId, username: profile.username, tab } });
    } else {
      router.push(`/network?tab=${tab}` as any);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { paddingHorizontal: 20, paddingTop: 20 },
        headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
        avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.base200 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 24, color: colors.primary },
        rightCol: { flex: 1, justifyContent: "flex-start" },
        username: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent },
        statsRow: { flexDirection: "row", gap: 28, marginTop: 10 },
        stat: { alignItems: "center" },
        statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent },
        statLabel: { color: colors.placeholder, fontSize: 12 },
        bio: { color: colors.baseContent, fontSize: 14, lineHeight: 20, marginTop: 14 },
        metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
        tierBadge: {
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        tierBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },
        joined: { color: colors.placeholder, fontSize: 13 },
      }),
    [colors]
  );

  const joinedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {profile.profile_pic_url ? (
          <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.rightCol}>
          <Text style={styles.username}>{profile.username}</Text>
          <View style={styles.statsRow}>
            {shareCount != null && (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{shareCount}</Text>
                <Text style={styles.statLabel}>{t("Shares")}</Text>
              </View>
            )}
            <Pressable style={styles.stat} onPress={() => goToNetwork("followers")}>
              <Text style={styles.statValue}>{profile.followers?.length ?? 0}</Text>
              <Text style={styles.statLabel}>{t("Followers")}</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => goToNetwork("following")}>
              <Text style={styles.statValue}>{profile.following?.length ?? 0}</Text>
              <Text style={styles.statLabel}>{t("Following")}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.bio}>{profile.bio || t("No bio yet.")}</Text>

      <View style={styles.metaRow}>
        {profile.accountTier && profile.accountTier !== "free" && (
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{profile.accountTier.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.joined}>
          {t("Joined")} {joinedDate}
        </Text>
      </View>

      {actionsSlot}
    </View>
  );
}
