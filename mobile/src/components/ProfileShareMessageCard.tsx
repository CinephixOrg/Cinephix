import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import TierAvatarFrame from "./TierAvatarFrame";
import type { Message } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const CARD_WIDTH = 220;
const AVATAR_SIZE = 44;

interface Props {
  message: Message;
  isOwn: boolean;
}

// Rendered inside a chat bubble in place of plain text for "hey, do you
// know this person?" shares — a compact avatar+username row (not a full
// profile preview) since there's nothing else worth previewing about a
// profile the way a poster previews a movie. Tap opens their Public
// Profile. Same own/other bubble-tint convention as RecommendationMessageCard.
export default function ProfileShareMessageCard({ message, isOwn }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: CARD_WIDTH,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: isOwn ? colors.primary : colors.base200,
          ...(isOwn ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
        },
        row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
        avatarFallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
        textCol: { flex: 1 },
        username: { fontFamily: fonts.bold, fontSize: 14, color: isOwn ? colors.primaryContent : colors.baseContent },
        hint: { fontSize: 12, color: isOwn ? colors.primaryContent : colors.placeholder, marginTop: 2 },
      }),
    [colors, isOwn]
  );

  const profileData = message.profileData;
  if (!profileData?.userId) return null;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/user/${profileData.userId}`)}>
      <View style={styles.row}>
        <TierAvatarFrame tier={profileData.accountTier} size={AVATAR_SIZE}>
          {(innerSize) =>
            profileData.profile_pic_url ? (
              <Image
                source={{ uri: profileData.profile_pic_url }}
                style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
              />
            ) : (
              <View style={[styles.avatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                <Text style={styles.avatarFallbackText}>{profileData.username.slice(0, 2).toUpperCase()}</Text>
              </View>
            )
          }
        </TierAvatarFrame>
        <View style={styles.textCol}>
          <Text style={styles.username} numberOfLines={1}>
            {profileData.username}
          </Text>
          <Text style={styles.hint}>{t("View Profile")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isOwn ? colors.primaryContent : colors.placeholder} />
      </View>
    </Pressable>
  );
}
