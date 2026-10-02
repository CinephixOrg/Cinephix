import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, ViewStyle } from "react-native";
// Gesture handler's inside the Media feed (TapSafeProvider): see common/TapSafePressable.tsx.
import Pressable from "./common/TapSafePressable";
import { useTranslation } from "react-i18next";
import { useFollowState } from "../hooks/useFollowState";
import type { FollowStatus } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  targetUserId: string;
  initialStatus?: FollowStatus;
  size?: "small" | "medium";
  style?: ViewStyle;
  // Fires only on an actual status transition (not on mount with whatever
  // the starting status happens to be) — for callers that keep their own
  // derived state in sync, e.g. Network's "16 Following" tab-label count
  // ticking down the moment a row is unfollowed, without a full refetch.
  onStatusChange?: (status: FollowStatus) => void;
}

export default function FollowButton({ targetUserId, initialStatus, size = "medium", style, onStatusChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
  },
  buttonSmall: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 76 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  text: { fontFamily: fonts.bold, fontSize: 14 },
  textSmall: { fontSize: 12 },
  textPrimary: { color: colors.primaryContent },
  textOutline: { color: colors.baseContent },
}), [colors]);
  const { t } = useTranslation();
  const { status, pending, follow, unfollow } = useFollowState(targetUserId, { initialStatus });

  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      onStatusChange?.(status);
      prevStatusRef.current = status;
    }
  }, [status, onStatusChange]);

  if (status === "self") return null;

  const isSmall = size === "small";
  const outline = status === "following";
  const label = outline ? t("Following") : t("Follow");

  const onPress = () => (status === "not-following" ? follow() : unfollow());

  return (
    <Pressable
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        outline ? styles.buttonOutline : styles.buttonPrimary,
        style,
      ]}
      onPress={onPress}
      disabled={pending}
    >
      {pending ? (
        <ActivityIndicator size="small" color={outline ? colors.baseContent : colors.primaryContent} />
      ) : (
        <Text
          style={[
            styles.text,
            isSmall && styles.textSmall,
            outline ? styles.textOutline : styles.textPrimary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

