import { useMemo, type ReactElement } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import TierAvatarFrame from "../TierAvatarFrame";

const AVATAR_SIZE = 84;

interface Props {
  profile: UserProfile;
  // Present only when this header is showing someone ELSE's profile — the
  // Followers/Following stats need to route to that user's network, not
  // "your own" (own-profile omits this and gets the simple self-scoped push).
  targetUserId?: string;
  // Rendered as the last element (below the bio, if any) — e.g. Public
  // Profile's Follow button + Cinematch panel, positioned directly above
  // whatever category-tab row the caller renders next.
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
        // paddingBottom is explicit (rather than relying on the last piece
        // of content's own margin) so the gap down to whatever the caller
        // renders next (actionsSlot, or the category tabs directly) stays
        // constant whether or not a bio is present — previously the
        // always-present "Joined {date}" line did this job implicitly.
        container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
        headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
        avatarFallback: { backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 24, color: colors.primary },
        rightCol: { flex: 1, justifyContent: "flex-start" },
        username: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent },
        // A bit wider than before — three tight stat columns read as
        // asymmetric/cramped next to the avatar's own generous spacing.
        statsRow: { flexDirection: "row", gap: 34, marginTop: 10 },
        stat: { alignItems: "center" },
        statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent },
        statLabel: { color: colors.placeholder, fontSize: 12 },
        bio: { color: colors.baseContent, fontSize: 14, lineHeight: 20, marginTop: 14 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TierAvatarFrame tier={profile.accountTier} size={AVATAR_SIZE}>
          {(innerSize) =>
            profile.profile_pic_url ? (
              <Image
                source={{ uri: profile.profile_pic_url }}
                style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
              />
            ) : (
              <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
              </View>
            )
          }
        </TierAvatarFrame>

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

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {actionsSlot}
    </View>
  );
}
