import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { CARD, PremiumPill, cardText } from "./chat/PremiumChatCard";
import type { Message } from "../types";
import { contentHref, formatRating } from "../utils/recommend";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
// The backdrop is blurred beyond recognition anyway, so it's drawn from the
// smallest poster TMDB serves: blurring on Android costs per pixel, and a
// 92px source looks the same once blurred as a 342px one at a fraction of it.
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w92";
const THUMB_WIDTH = 74;
const THUMB_HEIGHT = THUMB_WIDTH * 1.5;

const styles = StyleSheet.create({
  bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 12, paddingTop: 0 },
  thumbShadow: {
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
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
});

interface Props {
  message: Message;
  isOwn: boolean;
  onLongPress?: () => void;
}

function posterUri(posterUrl: string | undefined, base = POSTER_BASE): string | null {
  if (!posterUrl) return null;
  return posterUrl.startsWith("/") ? `${base}${posterUrl}` : posterUrl;
}

// A recommended movie or series: the poster blurred into the backdrop, the
// sharp poster over it, then the title, year, genres, rating and a line of
// synopsis. The frame is PremiumChatCard's, shared with every other rich
// chat item.
function RecommendationMessageCard({ message, isOwn, onLongPress }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  if (!message.contentId || !message.contentType) return null;

  const data = message.contentData ?? {};
  const uri = posterUri(data.posterUrl);
  const rating = formatRating(data.rating);
  const genres = (data.genres ?? []).slice(0, 2).map((genre) => t(genre));
  const typeLabel = t(message.contentType === "movie" ? "Movie" : "Series");
  const meta = [data.releaseYear, genres.length > 0 ? genres.join(", ") : typeLabel].filter(Boolean).join("  ·  ");
  const title = data.title || t("Untitled");
  const eyebrow = t(isOwn ? "You recommended" : "Recommended for you");

  return (
    <PremiumChatCard
      isOwn={isOwn}
      onLongPress={onLongPress}
      eyebrow={eyebrow}
      eyebrowIcon="sparkles"
      topRight={rating ? <PremiumPill icon="star" text={rating} /> : null}
      backdropUri={posterUri(data.posterUrl, BACKDROP_BASE)}
      heroHeight={THUMB_HEIGHT + 64}
      hero={
        <View style={styles.bottomRow}>
          <View style={styles.thumbShadow}>
            <View style={styles.thumb}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Ionicons name={message.contentType === "movie" ? "film-outline" : "tv-outline"} size={26} color={CARD.faint} />
              )}
            </View>
          </View>
          <View style={styles.info}>
            <Text style={cardText.title} numberOfLines={3}>
              {title}
            </Text>
            {meta ? (
              <Text style={cardText.meta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
      }
      body={
        data.overview ? (
          <Text style={cardText.body} numberOfLines={2}>
            {data.overview}
          </Text>
        ) : null
      }
      ctaLabel={t("View details")}
      onPress={() => router.push(contentHref(pathname, message.contentType!, message.contentId!) as never)}
      accessibilityLabel={`${eyebrow}: ${title}${meta ? `, ${meta}` : ""}`}
    />
  );
}

export default memo(RecommendationMessageCard);
