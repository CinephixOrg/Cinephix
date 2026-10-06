import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { CARD, cardText } from "./chat/PremiumChatCard";
import type { Message } from "../types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w92";
const THUMB_WIDTH = 74;
const THUMB_HEIGHT = THUMB_WIDTH * 1.5;

const styles = StyleSheet.create({
  bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 12, paddingTop: 0 },
  thumbShadow: { borderRadius: 10, shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 10,
    backgroundColor: "#1E1E28",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  info: { flex: 1, minWidth: 0, paddingBottom: 2 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: CARD.faint },
});

interface Props {
  message: Message;
  isOwn: boolean;
  onLongPress?: () => void;
}

function posterUri(posterUrl: string | null | undefined, base = POSTER_BASE): string | null {
  if (!posterUrl) return null;
  return posterUrl.startsWith("/") ? `${base}${posterUrl}` : posterUrl;
}

// A rich preview of whatever was just created in a community (poll,
// challenge, or watch party) — direct ask, after the auto-announcement
// first shipped as a plain-text bubble. Shares PremiumChatCard's exact
// frame with every other rich chat item (a recommendation, a shared
// list), just with content specific to each `kind`.
function CommunityAnnouncementMessageCard({ message, isOwn, onLongPress }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const data = message.communityAnnouncementData;
  if (!data) return null;

  const eyebrow =
    data.kind === "poll" ? t("New Poll") : data.kind === "challenge" ? t("New Challenge") : t("New Watch Party");
  const eyebrowIcon = data.kind === "poll" ? "bar-chart" : data.kind === "challenge" ? "trophy" : "calendar";
  const title =
    data.kind === "poll" ? data.question || t("Community Poll") : data.kind === "challenge" ? data.title || "" : data.title || "";
  const uri = posterUri(data.posterUrl);

  const onPress = () => {
    if (data.kind === "watchparty" && data.partyId) {
      router.push(`/socials/communities/${data.groupSlug}/watch-party/${data.partyId}` as never);
    } else {
      router.push(`/socials/communities/${data.groupSlug}` as never);
    }
  };

  const ctaLabel = data.kind === "poll" ? t("Vote") : data.kind === "challenge" ? t("View Challenge") : t("Join");

  return (
    <PremiumChatCard
      isOwn={isOwn}
      onLongPress={onLongPress}
      eyebrow={eyebrow}
      eyebrowIcon={eyebrowIcon}
      backdropUri={posterUri(data.posterUrl, BACKDROP_BASE)}
      heroHeight={THUMB_HEIGHT + 64}
      hero={
        <View style={styles.bottomRow}>
          <View style={styles.thumbShadow}>
            <View style={styles.thumb}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Ionicons name={eyebrowIcon} size={26} color={CARD.faint} />
              )}
            </View>
          </View>
          <View style={styles.info}>
            <Text style={cardText.title} numberOfLines={3}>
              {title}
            </Text>
            <Text style={cardText.meta} numberOfLines={1}>
              {data.groupName}
            </Text>
          </View>
        </View>
      }
      body={
        data.kind === "poll" && data.optionTexts?.length ? (
          <View>
            {data.optionTexts.slice(0, 3).map((optionText) => (
              <View key={optionText} style={styles.optionRow}>
                <View style={styles.optionDot} />
                <Text style={cardText.body} numberOfLines={1}>
                  {optionText}
                </Text>
              </View>
            ))}
          </View>
        ) : data.kind === "challenge" && data.itemCount ? (
          <Text style={cardText.body}>{t("{{count}} titles", { count: data.itemCount })}</Text>
        ) : data.kind === "watchparty" && data.scheduledAt ? (
          <Text style={cardText.body}>
            {new Date(data.scheduledAt).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null
      }
      ctaLabel={ctaLabel}
      onPress={onPress}
      accessibilityLabel={`${eyebrow}: ${title}`}
    />
  );
}

export default memo(CommunityAnnouncementMessageCard);
