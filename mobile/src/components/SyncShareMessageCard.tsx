import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ChatDeckStack, { DECK_CARD_WIDTH } from "./ChatDeckStack";
import type { Message, MatchAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";

interface Props {
  message: Message;
  isOwn: boolean;
  onPress: () => void;
}

// The chat-bubble preview for a Sync share (MatchCoverCard.tsx's own Share
// button, or AnalyzeModal's) — a gradient front card (the Sync tab's own
// "sparkles" identity + primary/secondary gradient, replacing the original
// flat-color card, direct ask for something more "cezbedici" than a bare
// percentage) sits in front of ChatDeckStack's two-layer deck illusion.
// No avatar on the front card itself — ChatRoom.tsx already renders the
// sender's own avatar next to the bubble for a received message, so
// repeating it inside the card here would just be the same face twice.
export default function SyncShareMessageCard({ message, isOwn, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const analysis = message.analysisData as MatchAnalysis | undefined;
  const pct = analysis?.matchPercentage;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: DECK_CARD_WIDTH },
        hint: { fontSize: 12.5, color: isOwn ? colors.primaryContent : colors.placeholder, marginBottom: 8 },
        gradient: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
        sparkle: { position: "absolute", top: 8, right: 10, opacity: 0.9 },
        pct: { fontFamily: fonts.bold, fontSize: 32, color: colors.primaryContent },
        label: {
          fontFamily: fonts.bold,
          fontSize: 10.5,
          color: colors.primaryContent,
          opacity: 0.9,
          letterSpacing: 1.4,
        },
        cta: { fontFamily: fonts.medium, fontSize: 10, color: colors.primaryContent, opacity: 0.8, marginTop: 4 },
      }),
    [colors, isOwn]
  );

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <Text style={styles.hint} numberOfLines={2}>
        {isOwn
          ? t("You shared a Sync. Tap to see details.")
          : t("{{username}} shared a Sync with you. Tap to see details.", { username: message.sender.username })}
      </Text>
      <ChatDeckStack>
        <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <Ionicons name="sparkles" size={16} color={colors.primaryContent} style={styles.sparkle} />
          {pct != null && <Text style={styles.pct}>{pct}%</Text>}
          <Text style={styles.label}>{localeUpper(t("Sync"))}</Text>
          <Text style={styles.cta}>{t("Tap to view")}</Text>
        </LinearGradient>
      </ChatDeckStack>
    </Pressable>
  );
}
