import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MatchTierRow from "./MatchTierRow";
import MatchGradientTitle from "./MatchGradientTitle";
import { CATEGORY_KEYS, categoryMeta } from "./matchCategoryMeta";
import { getOrCreateConversation, sendMessageRest, sendRichMessage } from "../../api/conversationService";
import { useChat } from "../../context/ChatContext";
import { useToast } from "../../context/ToastContext";
import type { SyncCandidate, MatchAnalysis } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  candidate: SyncCandidate;
  analysis: MatchAnalysis | null;
}

// The deck's own closing card — a celebratory recap (avatars + score, the
// same MatchTierRow the Sync Summary card's own header already uses, so
// this doesn't introduce a second "how the score looks" visual), the two
// categories this candidate scored highest in, and the actual Share action
// — reusing AnalyzeModal.tsx's own exact send flow
// (getOrCreateConversation -> sendRichMessage -> refreshConversations)
// rather than a second implementation of it. AnalyzeModal itself already
// has this Share button (wired from SyncScoreCard on public
// profiles), but the rebuilt Sync results deck never had its own — this is
// that gap filled, in the deck's own idiom (a card, not a modal button row).
export default function MatchCoverCard({ candidate, analysis }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState(false);

  // A fresh candidate's own "Shared" state shouldn't linger from whichever
  // candidate was shared last — same reset AnalyzeModal.tsx's own handler
  // already does when a new analysis comes in.
  useEffect(() => {
    setShared(false);
  }, [candidate.user._id]);

  const topCategories = useMemo(
    () => [...CATEGORY_KEYS].sort((a, b) => candidate.breakdown[b] - candidate.breakdown[a]).slice(0, 2),
    [candidate.breakdown]
  );

  const handleShare = async () => {
    if (!analysis) return;
    setSending(true);
    try {
      const conv = await getOrCreateConversation(candidate.user._id);
      // Only the fields SyncShareMessageCard.tsx/AnalyzeModal.tsx actually
      // read (matchPercentage for the preview card, provider/breakdown/
      // parsed for the full view once opened) — `analysis.raw` is the
      // *entire* unfiltered LLM provider API response (verified: never
      // read by any consumer), and the backend stores analysisData as-is
      // with no schema/validation (Schema.Types.Mixed) — sending it would
      // permanently bloat this chat message with third-party API metadata
      // the recipient has no reason to see.
      const { provider, matchPercentage, breakdown, parsed } = analysis;
      await sendRichMessage(conv._id, {
        text: t("📊 Shared a CineMatch analysis"),
        type: "analysis_share",
        analysisData: { provider, matchPercentage, breakdown, parsed },
      });
      // Sent as a second, separate plain-text message right after the card
      // — same direct ask AnalyzeModal.tsx's own handleShare satisfies.
      await sendMessageRest(conv._id, t("Check out our sync analyse!"));
      await refreshConversations();
      setShared(true);
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center", gap: 18, paddingTop: 8 },
        highlightRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
        highlightChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderWidth: 1.5,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        highlightDot: { width: 8, height: 8, borderRadius: 4 },
        highlightText: { fontSize: 12, fontFamily: fonts.medium },
        prompt: { fontSize: 13.5, color: colors.baseContent, textAlign: "center", lineHeight: 19, paddingHorizontal: 8 },
        shareButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: 28,
          minWidth: 200,
        },
        shareButtonDisabled: { opacity: 0.6 },
        shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14.5 },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <MatchGradientTitle text={t("Ready to share your Sync?")} gradientId="matchCoverGradient" />

      <MatchTierRow candidate={candidate} />

      <View style={styles.highlightRow}>
        {topCategories.map((key) => {
          const meta = categoryMeta(key, colors, t);
          return (
            <View key={key} style={[styles.highlightChip, { borderColor: meta.color }]}>
              <View style={[styles.highlightDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.highlightText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.prompt}>
        {t("Send {{username}} this whole Sync breakdown — they'll see everything you just saw.", {
          username: candidate.user.username,
        })}
      </Text>

      <Pressable
        style={[styles.shareButton, (sending || shared || !analysis) && styles.shareButtonDisabled]}
        onPress={handleShare}
        disabled={sending || shared || !analysis}
      >
        {sending ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <>
            <Ionicons name={shared ? "checkmark-circle" : "paper-plane"} size={17} color={colors.primaryContent} />
            <Text style={styles.shareButtonText}>{shared ? t("Shared") : t("Share this Sync")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
