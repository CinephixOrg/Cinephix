import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PremiumChatCard, { CARD, PremiumPill, cardText } from "./chat/PremiumChatCard";
import type { Message } from "../types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";
// Blurred beyond recognition, so the smallest size TMDB serves (see
// RecommendationMessageCard.tsx).
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w92";
const POSTER_WIDTH = 56;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
const FAN_STEP = 20;
// Back to front: the first poster sits on top, the others fan out behind it.
const FAN_ROTATION = ["-7deg", "0deg", "7deg"];

const styles = StyleSheet.create({
  bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 14, padding: 12, paddingTop: 0 },
  fan: { height: POSTER_HEIGHT + 6, justifyContent: "flex-end" },
  poster: {
    position: "absolute",
    bottom: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#1E1E28",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  emptyTile: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD.line,
  },
  info: { flex: 1, minWidth: 0, paddingBottom: 2 },
});

function posterUri(path: string, base: string): string {
  return path.startsWith("/") ? `${base}${path}` : path;
}

/** Up to three posters fanned out like cards in a hand; a list icon when there are none. */
function PosterFan({ posters }: { posters: string[] }) {
  if (posters.length === 0) {
    return (
      <View style={styles.emptyTile}>
        <Ionicons name="albums" size={24} color={CARD.faint} />
      </View>
    );
  }
  const width = POSTER_WIDTH + FAN_STEP * (posters.length - 1);
  return (
    <View style={[styles.fan, { width }]}>
      {posters
        .map((path, i) => (
          <Image
            key={`${i}:${path}`}
            source={{ uri: posterUri(path, POSTER_BASE) }}
            style={[
              styles.poster,
              { left: i * FAN_STEP, transform: [{ rotate: posters.length > 1 ? FAN_ROTATION[i] : "0deg" }] },
            ]}
          />
        ))
        // Drawn last-first so the first poster ends up on top.
        .reverse()}
    </View>
  );
}

interface Props {
  message: Message;
  isOwn: boolean;
}

// A shared custom list: its first poster blurred into the backdrop, up to
// three posters fanned out in front, the list's name, who made it, how many
// titles it holds and a line of its description. Older shares carry only
// the name, count and posters, and show just those.
function ListShareMessageCard({ message, isOwn }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const list = message.listData;
  if (!list?.listId) return null;

  const posters = (list.previewPosters ?? []).filter(Boolean).slice(0, 3);
  const count = typeof list.itemCount === "number" ? list.itemCount : null;
  const countLabel = count !== null ? t("item_count", { count }) : null;
  const owner = list.ownerUsername?.trim();
  const name = list.name || t("Untitled");

  return (
    <PremiumChatCard
      isOwn={isOwn}
      eyebrow={t("Shared a List")}
      eyebrowIcon="albums"
      topRight={countLabel ? <PremiumPill icon="film" text={countLabel} iconColor={CARD.white} /> : null}
      backdropUri={posters[0] ? posterUri(posters[0], BACKDROP_BASE) : null}
      heroHeight={POSTER_HEIGHT + 64}
      hero={
        <View style={styles.bottomRow}>
          <PosterFan posters={posters} />
          <View style={styles.info}>
            <Text style={cardText.title} numberOfLines={3}>
              {name}
            </Text>
            {owner ? (
              <Text style={cardText.meta} numberOfLines={1}>
                {t("by @{{username}}", { username: owner })}
              </Text>
            ) : null}
          </View>
        </View>
      }
      body={
        list.description ? (
          <Text style={cardText.body} numberOfLines={2}>
            {list.description}
          </Text>
        ) : null
      }
      ctaLabel={t("View List")}
      onPress={() => router.push(`/lists/${list.listId}` as never)}
      accessibilityLabel={`${t("Shared a List")}: ${name}${owner ? `, @${owner}` : ""}${countLabel ? `, ${countLabel}` : ""}`}
    />
  );
}

export default memo(ListShareMessageCard);
