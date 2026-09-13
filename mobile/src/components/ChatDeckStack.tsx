import { useMemo } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

export const DECK_CARD_WIDTH = 168;
export const DECK_CARD_HEIGHT = 92;
// How far each fainter layer behind the front card is offset — small enough
// that all three stay readable as "one deck", not three separate cards.
const STACK_OFFSET = 6;

interface Props {
  children: React.ReactNode;
  frontStyle?: StyleProp<ViewStyle>;
}

// Shared "there's a whole card-paged deck behind this preview" visual —
// two rectangles behind the given front content, slightly rotated and
// offset. Factored out of SyncShareMessageCard.tsx (its original, sole
// owner) so ProfileAnalysisShareMessageCard.tsx can reuse the exact same
// deck illusion for a visually-consistent chat card, direct ask ("sync
// tasarımı ile tutarlı hale getirelim").
//
// The back layers are a fixed neutral gray (not a theme token like
// `colors.base300`) at high opacity — direct ask after the original
// version (base300 at 0.45/0.75 opacity) read as barely visible against
// some palettes' own base300 being close to the chat bubble's background
// color to begin with. A fixed gray reads as "a card" regardless of theme.
export default function ChatDeckStack({ children, frontStyle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        stackArea: { width: DECK_CARD_WIDTH, height: DECK_CARD_HEIGHT + STACK_OFFSET * 2 },
        stackLayer2: {
          position: "absolute",
          left: STACK_OFFSET * 2,
          top: STACK_OFFSET * 2,
          width: DECK_CARD_WIDTH - STACK_OFFSET * 2,
          height: DECK_CARD_HEIGHT,
          borderRadius: 14,
          backgroundColor: "#9AA0A6",
          opacity: 0.55,
          borderWidth: 1,
          borderColor: colors.base100,
          transform: [{ rotate: "4deg" }],
        },
        stackLayer1: {
          position: "absolute",
          left: STACK_OFFSET,
          top: STACK_OFFSET,
          width: DECK_CARD_WIDTH - STACK_OFFSET,
          height: DECK_CARD_HEIGHT,
          borderRadius: 14,
          backgroundColor: "#9AA0A6",
          opacity: 0.85,
          borderWidth: 1,
          borderColor: colors.base100,
          transform: [{ rotate: "2deg" }],
        },
        front: {
          width: DECK_CARD_WIDTH - STACK_OFFSET * 2,
          height: DECK_CARD_HEIGHT,
          borderRadius: 14,
          overflow: "hidden",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.stackArea}>
      <View style={styles.stackLayer2} />
      <View style={styles.stackLayer1} />
      <View style={[styles.front, frontStyle]}>{children}</View>
    </View>
  );
}
