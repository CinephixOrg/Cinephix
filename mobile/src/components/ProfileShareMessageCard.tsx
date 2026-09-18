import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { PremiumChips, cardText } from "./chat/PremiumChatCard";
import TierAvatarFrame from "./TierAvatarFrame";
import type { Message } from "../types";
import { fonts } from "../theme/typography";

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, paddingTop: 0 },
  avatarShadow: {
    borderRadius: AVATAR_SIZE / 2,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  fallback: { backgroundColor: "#262633", alignItems: "center", justifyContent: "center" },
  fallbackText: { fontFamily: fonts.bold, fontSize: 20, color: "#FFFFFF" },
  info: { flex: 1, minWidth: 0 },
});

interface Props {
  message: Message;
  isOwn: boolean;
}

// A shared person, as a digital business card: their picture blurred into
// the backdrop, the picture itself (in their tier's frame), @username,
// followers, a line of bio and their top genres. Older shares only carry
// the name and picture, and simply show less.
function ProfileShareMessageCard({ message, isOwn }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = message.profileData;
  if (!profile?.userId) return null;

  const followers =
    typeof profile.followersCount === "number"
      ? t(profile.followersCount === 1 ? "{{count}} follower" : "{{count}} followers", { count: profile.followersCount })
      : null;
  const genres = (profile.topGenres ?? []).slice(0, 3).map((genre) => t(genre));

  return (
    <PremiumChatCard
      isOwn={isOwn}
      eyebrow={t("Profile")}
      eyebrowIcon="person-circle"
      backdropUri={profile.profile_pic_url}
      heroHeight={AVATAR_SIZE + 62}
      hero={
        <View style={styles.bottomRow}>
          <View style={styles.avatarShadow}>
            <TierAvatarFrame tier={profile.accountTier ?? undefined} size={AVATAR_SIZE}>
              {(inner) =>
                profile.profile_pic_url ? (
                  <Image source={{ uri: profile.profile_pic_url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
                ) : (
                  <View style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
                    <Text style={styles.fallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )
              }
            </TierAvatarFrame>
          </View>
          <View style={styles.info}>
            <Text style={cardText.title} numberOfLines={1}>
              @{profile.username}
            </Text>
            <Text style={cardText.meta} numberOfLines={1}>
              {followers ?? t("On Cinephix")}
            </Text>
          </View>
        </View>
      }
      body={
        profile.bio || genres.length > 0 ? (
          <>
            {profile.bio ? (
              <Text style={cardText.body} numberOfLines={2}>
                {profile.bio}
              </Text>
            ) : null}
            <PremiumChips items={genres} />
          </>
        ) : null
      }
      ctaLabel={t("View Profile")}
      onPress={() => router.push(`/user/${profile.userId}`)}
      accessibilityLabel={`${t("Profile")}: @${profile.username}${followers ? `, ${followers}` : ""}`}
    />
  );
}

export default memo(ProfileShareMessageCard);
