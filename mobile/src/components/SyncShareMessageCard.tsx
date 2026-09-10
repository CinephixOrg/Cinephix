import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { Message, MatchAnalysis } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const CARD_WIDTH = 168;
const CARD_HEIGHT = 92;
// How far each fainter layer behind the front card is offset — small enough
// that all three stay readable as "one deck", not three separate cards.
const STACK_OFFSET = 6;

interface Props {
  message: Message;
  isOwn: boolean;
  onPress: () => void;
}

// The chat-bubble preview for a Sync share (MatchCoverCard.tsx's own Share
// button, or SyncScoreCard's) — two fainter, slightly rotated
// rectangles behind the front card hint there's a whole card-paged deck
// behind this one preview (matching what MatchAnalysisPanel.tsx's real
// results deck actually is), rather than a bare "tap to see" text bubble.
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
        wrap: { width: CARD_WIDTH },
        text: { fontSize: 13, lineHeight: 18, marginBottom: 8, color: isOwn ? colors.primaryContent : colors.baseContent },
        stackArea: { width: CARD_WIDTH, height: CARD_HEIGHT + STACK_OFFSET * 2 },
        stackLayer2: {
          position: "absolute",
          left: STACK_OFFSET * 2,
          top: STACK_OFFSET * 2,
          width: CARD_WIDTH - STACK_OFFSET * 2,
          height: CARD_HEIGHT,
          borderRadius: 14,
          backgroundColor: colors.base300,
          opacity: 0.45,
          transform: [{ rotate: "4deg" }],
        },
        stackLayer1: {
          position: "absolute",
          left: STACK_OFFSET,
          top: STACK_OFFSET,
          width: CARD_WIDTH - STACK_OFFSET,
          height: CARD_HEIGHT,
          borderRadius: 14,
          backgroundColor: colors.base300,
          opacity: 0.75,
          transform: [{ rotate: "2deg" }],
        },
        front: {
          width: CARD_WIDTH - STACK_OFFSET * 2,
          height: CARD_HEIGHT,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        },
        pct: { fontFamily: fonts.bold, fontSize: 30, color: colors.primaryContent },
        label: {
          fontFamily: fonts.bold,
          fontSize: 10.5,
          color: colors.primaryContent,
          opacity: 0.85,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        },
      }),
    [colors, isOwn]
  );

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <Text style={styles.text}>
        {isOwn
          ? t("You shared a Sync. Tap to see details.")
          : t("{{username}} shared a Sync with you. Tap to see details.", { username: message.sender.username })}
      </Text>
      <View style={styles.stackArea}>
        <View style={styles.stackLayer2} />
        <View style={styles.stackLayer1} />
        <View style={styles.front}>
          {pct != null && <Text style={styles.pct}>{pct}%</Text>}
          <Text style={styles.label}>{t("Sync")}</Text>
        </View>
      </View>
    </Pressable>
  );
}
