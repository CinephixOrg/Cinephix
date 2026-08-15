import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { SwipeCandidate } from "../../types";
import MatchPercentageRing from "../MatchPercentageRing";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  candidate: SwipeCandidate;
}

// Pure presentational card — no gesture/animation awareness. SwipeCardStack
// wraps one of these per stack position and drives the drag/rotate/stamp
// animation around it, so this component stays reusable (e.g. for a static
// preview) and easy to reason about on its own.
export default function SwipeCard({ candidate }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          backgroundColor: colors.base200,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 8,
        },
        typeBadge: {
          position: "absolute",
          top: 18,
          left: 18,
          backgroundColor: colors.base300,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        typeBadgeText: { fontSize: 11, fontFamily: fonts.medium, color: colors.placeholder },
        avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 44, color: colors.primary },
        ringWrap: { marginTop: 20 },
        username: {
          fontFamily: fonts.bold,
          fontSize: 24,
          color: colors.baseContent,
          marginTop: 18,
          textAlign: "center",
        },
        bio: {
          color: colors.placeholder,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
          marginTop: 10,
          paddingHorizontal: 8,
        },
      }),
    [colors]
  );

  const { user, matchPercentage, contentType } = candidate;

  return (
    <View style={styles.card}>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>
          {contentType === "movie" ? t("🎬 Movies") : t("📺 Series")}
        </Text>
      </View>

      {user.profile_pic_url ? (
        <Image source={{ uri: user.profile_pic_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{user.username.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.ringWrap}>
        <MatchPercentageRing percentage={matchPercentage} size={64} strokeWidth={6} />
      </View>

      <Text style={styles.username} numberOfLines={1}>
        {user.username}
      </Text>
      {user.bio ? (
        <Text style={styles.bio} numberOfLines={3}>
          {user.bio}
        </Text>
      ) : null}
    </View>
  );
}
