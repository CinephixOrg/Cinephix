import { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const FADE_DURATION_MS = 200;

export default function Toast() {
  const { message } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { backgroundColor: colors.base300, bottom: 24 + insets.bottom, opacity },
      ]}
    >
      <Text style={[styles.text, { color: colors.baseContent }]}>{displayText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
});
