import { useEffect, useRef, useState } from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const FADE_DURATION_MS = 200;

export default function Toast() {
  const { message } = useToast();
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setDisplayText(message);
      Animated.timing(opacity, { toValue: 1, duration: FADE_DURATION_MS, useNativeDriver: true }).start();
    } else if (displayText) {
      Animated.timing(opacity, { toValue: 0, duration: FADE_DURATION_MS, useNativeDriver: true }).start(() => {
        setDisplayText(null);
      });
    }
    // displayText deliberately excluded — only `message` changes should drive this effect,
    // re-running it on displayText would restart the fade-out animation on its own completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!displayText) return null;

  // Centered on screen, width hugging the text itself (no left/right
  // stretch) — a real requirement, not a bottom-anchored full-width bar
  // like before: the outer `overlay` is a full-screen absolute layer that
  // just centers its one child, so the bubble's own width is purely
  // however wide `displayText` renders (capped by maxWidth for the rare
  // long message, e.g. the "Something went wrong..." error text).
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.toast, { backgroundColor: colors.base300, opacity }]}>
        <Text style={[styles.text, { color: colors.baseContent }]}>{displayText}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: "80%",
  },
  text: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
});
