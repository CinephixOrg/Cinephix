import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MatchResult } from "../types";
import MatchPercentageRing from "./MatchPercentageRing";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  match: MatchResult;
  rank?: number;
  onAnalyze: (targetUserId: string) => void;
  analyzing?: boolean;
}

// Deliberately no "View Profile" action — mobile has no other-user-profile
// screen yet (viewing another user's profile is out of scope for this pass,
// deferred along with the rest of that feature).
export default function MatchCard({ match, rank, onAnalyze, analyzing }: Props) {
  const { t } = useTranslation();
  const { user, matchPercentage } = match;

  return (
    <View style={styles.card}>
      {rank && rank <= 3 && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank === 1 ? "👑" : `#${rank}`}</Text>
        </View>
      )}

      {user.profile_pic_url ? (
        <Image source={{ uri: user.profile_pic_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{user.username.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.username} numberOfLines={1}>
        {user.username}
      </Text>
      {user.bio ? (
        <Text style={styles.bio} numberOfLines={2}>
          {user.bio}
        </Text>
      ) : null}

      <MatchPercentageRing percentage={matchPercentage} />

      <Pressable
        style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
        onPress={() => onAnalyze(user._id)}
        disabled={analyzing}
      >
        {analyzing ? (
          <ActivityIndicator size="small" color={colors.primaryContent} />
        ) : (
          <Text style={styles.analyzeButtonText}>{t("Analyze")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  rankBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.base300,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  rankBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.baseContent },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.base300 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  username: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.baseContent,
    marginTop: 8,
    alignSelf: "stretch",
    textAlign: "center",
  },
  bio: {
    fontSize: 12,
    color: colors.placeholder,
    textAlign: "center",
    marginTop: 2,
  },
  analyzeButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  analyzeButtonDisabled: { opacity: 0.6 },
  analyzeButtonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryContent },
});
