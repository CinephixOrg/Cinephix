import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import UserAvatar from "../UserAvatar";
import { wrapMatchTitle, BADGE_WIDTH, LINE_HEIGHT, FONT_SIZE } from "./MatchTitleBadge";
import { CATEGORY_KEYS, categoryMeta } from "./matchCategoryMeta";
import { getOrCreateConversation, sendMessageRest, sendRichMessage } from "../../api/conversationService";
import { useChat } from "../../context/ChatContext";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import type { SyncCandidate, MatchAnalysis } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  candidate: SyncCandidate;
  analysis: MatchAnalysis | null;
}

const AVATAR_SIZE = 76;
// Ring thickness around each avatar, same color as the card's own
// background — where the front avatar overlaps the back one, this reads as
// a clean cutout (the classic "stacked avatars" treatment) rather than the
// two photos just visually colliding.
const AVATAR_RING = 5;
const AVATAR_SLOT = AVATAR_SIZE + AVATAR_RING * 2;
// How far the second avatar overlaps into the first — a Venn-diagram
// read (partial overlap), not the old side-by-side layout with a badge/bar
// between them. Direct ask.
const AVATAR_OVERLAP = 30;

// The deck's own closing card — direct redesign: starts straight with the
// two profiles overlapping (no separate "Ready to share?" headline above
// them anymore), the LLM's own match_title sitting right underneath in
// place of the old score bar, then the two highlight categories, the share
// prompt, and the actual Share action — reusing AnalyzeModal.tsx's own
// exact send flow (getOrCreateConversation -> sendRichMessage ->
// refreshConversations) rather than a second implementation of it.
//
// The match_title here is rendered statically (MatchTitleBadge.tsx's own
// exported wrapMatchTitle + sizing constants, same gradient-text look) —
// deliberately NOT MatchTitleBadge itself: its stamp-in entrance animation
// is meant to stay exclusive to the Sync Summary card, direct ask, so this
// card never imports that component at all.
export default function MatchCoverCard({ candidate, analysis }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
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

  const titleLines = useMemo(
    () => (analysis?.parsed?.match_title ? wrapMatchTitle(analysis.parsed.match_title) : []),
    [analysis?.parsed?.match_title]
  );
  const titleSvgHeight = titleLines.length * LINE_HEIGHT + 6;

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
        wrap: { alignItems: "center", gap: 14, paddingTop: 4 },
        avatarVenn: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
        avatarRing: {
          width: AVATAR_SLOT,
          height: AVATAR_SLOT,
          borderRadius: AVATAR_SLOT / 2,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarRingFront: { marginLeft: -AVATAR_OVERLAP, zIndex: 1 },
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
          // Android's ripple/foreground on a gesture-handler Pressable
          // draws as its own rectangle and bleeds past the view's own
          // rounded corners unless the Pressable itself clips — same root
          // cause as MatchFilterStrip's Sync button reading "square"
          // despite its own fill already being rounded. Direct report: this
          // button's corners looked sharp on-device.
          overflow: "hidden",
          paddingVertical: 13,
          paddingHorizontal: 28,
          minWidth: 200,
        },
        shareButtonDisabled: { opacity: 0.6 },
        shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14.5 },
      }),
    [colors]
  );

  if (!user) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarVenn}>
        <View style={styles.avatarRing}>
          <UserAvatar userId={user._id} username={user.username} profilePicUrl={user.profile_pic_url} size={AVATAR_SIZE} />
        </View>
        <View style={[styles.avatarRing, styles.avatarRingFront]}>
          <UserAvatar userId={candidate.user._id} username={candidate.user.username} profilePicUrl={candidate.user.profile_pic_url} size={AVATAR_SIZE} />
        </View>
      </View>

      {titleLines.length > 0 && (
        <Svg width={BADGE_WIDTH} height={titleSvgHeight} style={{ overflow: "visible" }}>
          <Defs>
            <LinearGradient id="matchCoverStaticTitleGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="0.5" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor={colors.secondary} />
            </LinearGradient>
          </Defs>
          {titleLines.map((line, i) => (
            <SvgText
              key={i}
              x="50%"
              y={(i + 1) * LINE_HEIGHT - 6}
              textAnchor="middle"
              fontFamily={fonts.extrabold}
              fontSize={FONT_SIZE}
              fontWeight="800"
              fill="url(#matchCoverStaticTitleGradient)"
            >
              {line}
            </SvgText>
          ))}
        </Svg>
      )}

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
