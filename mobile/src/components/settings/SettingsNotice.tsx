import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type Tone = "error" | "success";

interface Props {
  tone: Tone;
  message: string | null;
}

// Inline feedback under a section's action. Animates in and, crucially,
// animates the *height* as well as the opacity — a message that only fades
// in would still have reserved its space, pushing the page down before
// anything was there to read.
function SettingsNotice({ tone, message }: Props) {
  const { colors } = useTheme();
  const reveal = useRef(new Animated.Value(0)).current;
  // Kept so the text stays rendered while it animates away.
  const lastMessage = useRef(message);
  if (message) lastMessage.current = message;

  useEffect(() => {
    const animation = Animated.timing(reveal, {
      toValue: message ? 1 : 0,
      duration: message ? 220 : 140,
      easing: Easing.out(Easing.cubic),
      // Height is not a native-driver property, and animating opacity
      // separately would need a second Animated.Value for no benefit.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reveal, message]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "flex-start", gap: 7, overflow: "hidden" },
        text: {
          flex: 1,
          fontFamily: fonts.regular,
          fontSize: 12,
          lineHeight: 16,
          color: tone === "error" ? colors.error : colors.success,
        },
      }),
    [colors, tone]
  );

  if (!lastMessage.current) return null;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: reveal,
          maxHeight: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }),
          marginTop: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }),
        },
      ]}
    >
      <Ionicons
        name={tone === "error" ? "alert-circle" : "checkmark-circle"}
        size={14}
        color={tone === "error" ? colors.error : colors.success}
        style={{ marginTop: 1 }}
      />
      <Text style={styles.text}>{lastMessage.current}</Text>
    </Animated.View>
  );
}

export default memo(SettingsNotice);
