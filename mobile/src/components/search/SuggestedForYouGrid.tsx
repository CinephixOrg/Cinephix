import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { getRecommendations, type RecommendationItem } from "../../api/feedService";
import MiniContentCard from "../MiniContentCard";
import type { ContentType } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POOL_SIZE = 20;
const PICK_COUNT = 4;
const GRID_GAP = 10;
const CARD_PADDING = 16;
// Same cross-fade-batches technique FadingMemberAvatars.tsx/
// DailyGameCard.tsx's own ticker already use — direct ask ("belli
// saniyede bir bu 4 poster yenilensin... daily puzzle ya da community
// member gösterimindeki profil akışı gibi"). Slower than either of those
// (2.5-2.8s) since a block of 4 posters needs a moment to actually look
// at, not a single glanceable avatar/line of text.
const ROTATE_MS = 6000;
const FADE_MS = 400;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Fills Search's Movies/Series empty state (no query, no filter) with a
// genre-weighted, not-yet-watched pick off the viewer's own CineGraph —
// same feedController.js `getRecommendations` endpoint Discover's
// WhatToWatchRail already uses, filtered to this tab's own contentType.
// One fetch (a generous pool), shuffled and sliced into batches of 4
// client-side, which then cross-fade/rotate through on an interval —
// "fresh 4 every so often" with no repeated network round trips.
export default function SuggestedForYouGrid({ contentType }: { contentType: ContentType }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [batches, setBatches] = useState<RecommendationItem[][] | null>(null);
  const [batchIndex, setBatchIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getRecommendations(POOL_SIZE, contentType)
      .then((res) => {
        if (cancelled) return;
        const pool = shuffled(res.recommendations);
        const out: RecommendationItem[][] = [];
        for (let i = 0; i < pool.length; i += PICK_COUNT) out.push(pool.slice(i, i + PICK_COUNT));
        setBatches(out);
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [contentType]);

  useEffect(() => {
    setBatchIndex(0);
    if (!batches || batches.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setBatchIndex((i) => (i + 1) % batches.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [batches, opacity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", paddingHorizontal: 20, paddingTop: 16 },
        // "Koyu renkli kutucuk" — direct ask: the whole section now sits
        // inside its own dark card instead of floating directly on the
        // page background.
        card: { backgroundColor: colors.base300, borderRadius: 16, padding: CARD_PADDING },
        title: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.baseContent, marginBottom: 12 },
        row: { flexDirection: "row", gap: GRID_GAP },
      }),
    [colors]
  );

  // Measured on a plain View with no padding of its own (the card's
  // padding lives on its parent) — direct report: the previous version
  // measured the PADDED container itself and sized cards off that full
  // width, so the row (which still had to fit inside that same padding)
  // overflowed the screen by exactly the padding amount.
  const onLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);
  const cardWidth = rowWidth > 0 ? (rowWidth - GRID_GAP * (PICK_COUNT - 1)) / PICK_COUNT : 0;

  if (batches !== null && batches.length === 0) return null;
  const current = batches?.[batchIndex] ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{t("Suggested for you")}</Text>
        <View onLayout={onLayout}>
          {cardWidth > 0 && (
            <Animated.View style={[styles.row, { opacity }]}>
              {(current.length > 0 ? current : Array.from({ length: PICK_COUNT }, () => null)).map((item, i) =>
                item ? (
                  <MiniContentCard
                    key={`${item.contentType}-${item._id}`}
                    id={item._id}
                    type={item.contentType}
                    posterPath={item.poster_path}
                    basePath="/search"
                    style={{ width: cardWidth }}
                  />
                ) : (
                  <View key={i} style={{ width: cardWidth, aspectRatio: 2 / 3, borderRadius: 4, backgroundColor: colors.base200 }} />
                )
              )}
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
