import { memo, useMemo, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Message } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";
import { contentHref, formatRating } from "../utils/recommend";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
// The backdrop is blurred beyond recognition anyway, so it's drawn from the
// smallest poster TMDB serves: blurring on Android costs per pixel, and a
// 92px source looks the same once blurred as a 342px one at a fraction of it.
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w92";
const MAX_WIDTH = 264;
const THUMB_WIDTH = 74;
const THUMB_HEIGHT = THUMB_WIDTH * 1.5;

const WHITE = "#FFFFFF";
const INK = "#0C0C12";
const GOLD = "#FBBF24";

interface Props {
  message: Message;
  isOwn: boolean;
}

function posterUri(posterUrl: string | undefined, base = POSTER_BASE): string | null {
  if (!posterUrl) return null;
  return posterUrl.startsWith("/") ? `${base}${posterUrl}` : posterUrl;
}

// A recommended movie or series inside a chat, as a small poster ad: the
// poster blurred into a backdrop, the sharp poster over it, then the title,
// year, genres and rating, a line of synopsis and a way in.
//
// Always dark, whatever the theme — it's a piece of media, like a poster on
// a wall — and the sender's side is marked by the bubble's squared corner,
// as with every other message.
function RecommendationMessageCard({ message, isOwn }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(MAX_WIDTH, Math.round((screenWidth - 32) * 0.72));
  const scale = useRef(new Animated.Value(1)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: INK,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.14)",
        },
        // Clips the backdrop, which is scaled up past its edges to hide the
        // blur's soft rim — unclipped, it spilled down behind the synopsis.
        hero: { height: THUMB_HEIGHT + 64, justifyContent: "flex-end", overflow: "hidden" },
        backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, transform: [{ scale: 1.35 }] },
        topRow: {
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        pill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: "rgba(0,0,0,0.38)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.22)",
        },
        eyebrow: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.9, color: WHITE },
        rating: { fontFamily: fonts.bold, fontSize: 11.5, color: WHITE },
        bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 12, paddingTop: 0 },
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
        thumbShadow: {
          borderRadius: 10,
          shadowColor: "#000",
          shadowOpacity: 0.55,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
        info: { flex: 1, minWidth: 0, paddingBottom: 2 },
        title: { fontFamily: fonts.extrabold, fontSize: 16.5, lineHeight: 20.5, color: WHITE, letterSpacing: -0.2 },
        meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.72)", marginTop: 4 },
        body: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 10, backgroundColor: INK },
        overview: { fontSize: 12.5, lineHeight: 17.5, color: "rgba(255,255,255,0.66)" },
        cta: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 36,
          borderRadius: 12,
        },
        ctaText: { fontFamily: fonts.bold, fontSize: 13.5 },
      }),
    [width]
  );

  if (!message.contentId || !message.contentType) return null;

  const data = message.contentData ?? {};
  const uri = posterUri(data.posterUrl);
  const backdropUri = posterUri(data.posterUrl, BACKDROP_BASE);
  const rating = formatRating(data.rating);
  const genres = (data.genres ?? []).slice(0, 2).map((genre) => t(genre));
  const typeLabel = t(message.contentType === "movie" ? "Movie" : "Series");
  const meta = [data.releaseYear, genres.length > 0 ? genres.join(", ") : typeLabel].filter(Boolean).join("  ·  ");
  const title = data.title || t("Untitled");
  const ctaColor = isOwn ? colors.primaryContent : WHITE;

  const pressTo = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: value === 1 ? 6 : 0, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.card, isOwn ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }]}
        onPress={() => router.push(contentHref(pathname, message.contentType!, message.contentId!) as never)}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        accessibilityRole="button"
        accessibilityLabel={`${t(isOwn ? "You recommended" : "Recommended for you")}: ${title}${meta ? `, ${meta}` : ""}`}
      >
        <View style={styles.hero}>
          {backdropUri ? <Image source={{ uri: backdropUri }} style={styles.backdrop} blurRadius={12} resizeMode="cover" /> : null}
          <LinearGradient
            colors={uri ? ["rgba(12,12,18,0.25)", "rgba(12,12,18,0.6)", INK] : ["#2A2440", "#15131F", INK]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topRow}>
            <View style={styles.pill}>
              <Ionicons name="sparkles" size={11} color={GOLD} />
              <Text style={styles.eyebrow}>{localeUpper(t(isOwn ? "You recommended" : "Recommended for you"))}</Text>
            </View>
            {rating ? (
              <View style={styles.pill}>
                <Ionicons name="star" size={11} color={GOLD} />
                <Text style={styles.rating}>{rating}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.thumbShadow}>
              <View style={styles.thumb}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Ionicons name={message.contentType === "movie" ? "film-outline" : "tv-outline"} size={26} color="rgba(255,255,255,0.5)" />
                )}
              </View>
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={3}>
                {title}
              </Text>
              {meta ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {data.overview ? (
            <Text style={styles.overview} numberOfLines={2}>
              {data.overview}
            </Text>
          ) : null}
          <View style={[styles.cta, { backgroundColor: isOwn ? colors.primary : "rgba(255,255,255,0.12)" }]}>
            <Text style={[styles.ctaText, { color: ctaColor }]}>{t("View details")}</Text>
            <Ionicons name="arrow-forward" size={15} color={ctaColor} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(RecommendationMessageCard);
