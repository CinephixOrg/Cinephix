import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import FollowButton from "./FollowButton";
import TierAvatarFrame from "./TierAvatarFrame";
import type { SuggestedUser } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const AVATAR_SIZE = 52;

interface Props {
  user: SuggestedUser;
}

export default function SuggestedUserCard({ user }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: {
    width: 130,
    marginRight: 12,
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  avatarFallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  username: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent, marginTop: 8, maxWidth: 106 },
  mutual: { fontSize: 11, color: colors.placeholder, marginTop: 2, textAlign: "center" },
  followButton: { marginTop: 8, minWidth: 0, alignSelf: "stretch" },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/user/${user._id}`)}>
      <TierAvatarFrame tier={user.accountTier} size={AVATAR_SIZE} backgroundColor={colors.base200}>
        {(innerSize) =>
          user.profile_pic_url ? (
            <Image
              source={{ uri: user.profile_pic_url }}
              style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
            />
          ) : (
            <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
              <Text style={styles.avatarFallbackText}>{user.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )
        }
      </TierAvatarFrame>
      <Text style={styles.username} numberOfLines={1}>
        {user.username}
      </Text>
      <Text style={styles.mutual}>
        {t("mutual_count", { count: user.mutualCount })}
      </Text>
      <FollowButton targetUserId={user._id} size="small" style={styles.followButton} />
    </Pressable>
  );
}

