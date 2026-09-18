import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { CARD, cardText } from "./chat/PremiumChatCard";
import CardAvatar from "./chat/CardAvatar";
import { useAuth } from "../context/AuthContext";
import { MATCH_TONE_COLOR, matchTone } from "../utils/shareCards";
import type { MatchAnalysis, Message, MessageSender } from "../types";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";

const AVATAR_SIZE = 54;
// For an older share without a percentage.
const NEUTRAL_ACCENT = "#A78BFA";

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingBottom: 12 },
  avatars: { flexDirection: "row", alignItems: "center" },
  overlap: { marginLeft: -14 },
  score: { fontFamily: fonts.extrabold, fontSize: 38, lineHeight: 44, marginTop: 6, textShadowRadius: 16 },
  scoreLabel: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.6, color: CARD.text, marginTop: -2 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19.5, color: CARD.white, textAlign: "center" },
  names: { fontSize: 12, color: CARD.faint, textAlign: "center", marginTop: 2 },
});

interface Props {
  message: Message;
  isOwn: boolean;
  onPress: () => void;
  /** The other person in this chat — the second face of the pair. */
  counterpart?: MessageSender;
}

// A shared Sync (CineMatch): the two people side by side, their match score
// glowing in its tone — green when high, amber in the middle, warm red when
// low — and the match's own title. A Sync is always between the two people
// in the DM it was sent to, so the pair is the sender and whoever else is in
// this chat.
function SyncShareMessageCard({ message, isOwn, onPress, counterpart }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const analysis = message.analysisData as MatchAnalysis | undefined;
  const pct = typeof analysis?.matchPercentage === "number" ? Math.round(analysis.matchPercentage) : null;
  const tone = pct !== null ? MATCH_TONE_COLOR[matchTone(pct)] : NEUTRAL_ACCENT;

  const sender = message.sender;
  const other = isOwn
    ? counterpart
    : user
      ? { _id: user._id, username: user.username, profile_pic_url: user.profile_pic_url }
      : undefined;
  const title = analysis?.parsed?.match_title?.trim();
  const names = other ? `${sender.username} & ${other.username}` : sender.username;
  const scoreText = pct !== null ? `${pct}%` : t("Sync");

  return (
    <PremiumChatCard
      isOwn={isOwn}
      eyebrow={t("CineMatch Sync")}
      eyebrowIcon="pulse"
      eyebrowColor={tone}
      accent={tone}
      heroHeight={AVATAR_SIZE + 118}
      hero={
        <View style={styles.hero}>
          <View style={styles.avatars}>
            <CardAvatar uri={sender.profile_pic_url} username={sender.username} size={AVATAR_SIZE} ringColor={tone} />
            {other ? (
              <View style={styles.overlap}>
                <CardAvatar uri={other.profile_pic_url} username={other.username} size={AVATAR_SIZE} ringColor={tone} />
              </View>
            ) : null}
          </View>
          <Text style={[styles.score, { color: tone, textShadowColor: `${tone}AA` }]}>{scoreText}</Text>
          {pct !== null ? <Text style={styles.scoreLabel}>{localeUpper(t("Match"))}</Text> : null}
        </View>
      }
      body={
        <View>
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          <Text style={[styles.names, !title && cardText.body]} numberOfLines={1}>
            {names}
          </Text>
        </View>
      }
      ctaLabel={t("See Details")}
      onPress={onPress}
      accessibilityLabel={`${t("CineMatch Sync")}: ${names}${pct !== null ? `, ${pct}%` : ""}${title ? `, ${title}` : ""}`}
    />
  );
}

export default memo(SyncShareMessageCard);
