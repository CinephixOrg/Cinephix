import { useEffect, useRef, useState } from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const FADE_DURATION_MS = 200;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Toast() {
  const { message, type } = useToast();
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

  // "success" reads as genuinely more prominent (reported live as too
  // easy to miss, e.g. ShareCard.tsx's "Added to Watchlist") without
  // guessing a fixed text color against `colors.success` directly — that
  // token's actual luminance varies a lot across this app's 9 themes (a
  // dark saturated green in some, a light mint in others), so a solid fill
  // risks poor contrast in at least a few of them. A light tint of it as
  // the background plus a solid border/icon in the same color stays
  // legible everywhere (text stays the always-safe colors.baseContent)
  // while still reading as distinctly "successful," not just louder.
  const isSuccess = type === "success";

  // Centered on screen, width hugging the text itself (no left/right
  // stretch) — a real requirement, not a bottom-anchored full-width bar
  // like before: the outer `overlay` is a full-screen absolute layer that
  // just centers its one child, so the bubble's own width is purely
  // however wide `displayText` renders (capped by maxWidth for the rare
  // long message, e.g. the "Something went wrong..." error text).
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: isSuccess ? hexToRgba(colors.success, 0.16) : colors.base300,
            borderWidth: isSuccess ? 1.5 : 0,
            borderColor: colors.success,
            opacity,
          },
        ]}
      >
        {isSuccess && <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.icon} />}
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: "80%",
  },
  icon: { marginRight: 6 },
  text: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
});
