import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  /** What's waiting to be removed (a title, a list), or null when nothing is pending. */
  entry: object | null;
  message: string;
  durationMs: number;
  onUndo: () => void;
}

// Floating "Removed — Undo" bar.
//
// With edit-mode tap targets this large, a mis-tap is easy. On the Watched
// List it would also be real data loss — removing a title there deletes the
// user's rating and favorite status for it — so the delete is held back for
// `durationMs` and this bar offers the way out. The shrinking line shows how
// long is left.
function CollectionUndoBar({ entry, message, durationMs, onUndo }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const reveal = useRef(new Animated.Value(0)).current;
  const remaining = useRef(new Animated.Value(1)).current;
  // Kept so the bar stays on screen while it slides away.
  const [shown, setShown] = useState<object | null>(entry);

  useEffect(() => {
    if (entry) setShown(entry);
    const animation = Animated.timing(reveal, {
      toValue: entry ? 1 : 0,
      duration: entry ? 240 : 180,
      easing: entry ? Easing.out(Easing.back(1.2)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !entry) setShown(null);
    });

    if (!entry) return () => animation.stop();
    remaining.setValue(1);
    const countdown = Animated.timing(remaining, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    countdown.start();
    return () => {
      animation.stop();
      countdown.stop();
    };
  }, [entry, durationMs, reveal, remaining]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: "absolute", left: 16, right: 16, bottom: 16 },
        bar: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 52,
          borderRadius: 16,
          paddingLeft: 16,
          paddingRight: 6,
          backgroundColor: colors.baseContent,
          overflow: "hidden",
        },
        text: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.base100 },
        undo: { flexDirection: "row", alignItems: "center", gap: 5, height: 40, borderRadius: 12, paddingHorizontal: 14 },
        undoText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
        progress: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: colors.primary,
          transformOrigin: "left",
        },
      }),
    [colors]
  );

  if (!shown) return null;

  return (
    <Animated.View
      pointerEvents={entry ? "box-none" : "none"}
      style={[
        styles.wrap,
        { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }] },
      ]}
    >
      <View style={styles.bar}>
        <Ionicons name="trash-outline" size={18} color={colors.base100} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
        <Pressable onPress={onUndo} hitSlop={6} accessibilityRole="button" style={({ pressed }) => [styles.undo, pressed && { opacity: 0.6 }]}>
          <Ionicons name="arrow-undo" size={16} color={colors.primary} />
          <Text style={styles.undoText}>{t("Undo")}</Text>
        </Pressable>
        <Animated.View style={[styles.progress, { transform: [{ scaleX: remaining }] }]} />
      </View>
    </Animated.View>
  );
}

export default memo(CollectionUndoBar);
