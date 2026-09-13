import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ChatDeckStack, { DECK_CARD_WIDTH } from "./ChatDeckStack";
import type { Message, ProfileAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";

interface Props {
  message: Message;
  isOwn: boolean;
  onPress: () => void;
}

// Profile-analysis chat counterpart to SyncShareMessageCard.tsx — same
// ChatDeckStack deck illusion and gradient front card, direct ask to make
// this consistent with Sync's own design instead of the original plain
// text bubble ("📊 Shared their profile analysis"). Shows the analysis's
// own generated nickname (e.g. "The Auteur") as the headline in place of
// Sync's percentage — the one piece of this result compelling enough to
// preview without opening it.
export default function ProfileAnalysisShareMessageCard({ message, isOwn, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const analysis = message.analysisData as ProfileAnalysis | undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: DECK_CARD_WIDTH },
        hint: { fontSize: 12.5, color: isOwn ? colors.primaryContent : colors.placeholder, marginBottom: 8 },
        gradient: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 10 },
        sparkle: { position: "absolute", top: 8, right: 10, opacity: 0.9 },
        nickname: { fontFamily: fonts.bold, fontSize: 17, color: colors.primaryContent, textAlign: "center" },
        label: {
          fontFamily: fonts.bold,
          fontSize: 10.5,
          color: colors.primaryContent,
          opacity: 0.9,
          letterSpacing: 1.4,
          marginTop: 4,
        },
        cta: { fontFamily: fonts.medium, fontSize: 10, color: colors.primaryContent, opacity: 0.8, marginTop: 4 },
      }),
    [colors, isOwn]
  );

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <Text style={styles.hint} numberOfLines={2}>
        {isOwn
          ? t("You shared your profile analysis. Tap to see details.")
          : t("{{username}} shared their profile analysis with you. Tap to see details.", {
              username: message.sender.username,
            })}
      </Text>
      <ChatDeckStack>
        <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <Ionicons name="document-text" size={16} color={colors.primaryContent} style={styles.sparkle} />
          {analysis?.nickname ? (
            <Text style={styles.nickname} numberOfLines={2}>
              {analysis.nickname}
            </Text>
          ) : null}
          <Text style={styles.label}>{localeUpper(t("Profile Analysis"))}</Text>
          <Text style={styles.cta}>{t("Tap to view")}</Text>
        </LinearGradient>
      </ChatDeckStack>
    </Pressable>
  );
}
