import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

interface Props {
  text: string;
  onDismiss: () => void;
  style?: object;
}

// The instruction line for whichever step of a compose-tutorial walkthrough
// is currently active (TutorialSpotlight.tsx highlights the matching UI;
// this is the accompanying "what to do" text) — a plain bulb-icon card
// placed right at each step's own call site, not a floating tooltip with
// positioning math, since each screen already knows exactly where its own
// highlighted element sits. The "X" is the tutorial's only way to be
// cancelled early — direct ask didn't specify this, but a guided flow with
// no escape hatch if someone changes their mind partway through isn't a
// real option.
export default function TutorialInfoBox({ text, onDismiss, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <View style={[styles.card, style]}>
      <Ionicons name="bulb-outline" size={16} color={colors.primary} />
      <Text style={styles.text}>{text}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.placeholder} />
      </Pressable>
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    text: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.baseContent, lineHeight: 17 },
  });
}
