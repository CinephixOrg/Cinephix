import { memo, useMemo } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Pressable from "./TapSafePressable";
import { useTheme } from "../../context/ThemeContext";
import type { ContentType } from "../../types";

/**
 * Discover's round Movies/Series switch, right after a section's title: both
 * icons always showing, the selected one in the primary colour (no filled
 * chip — that read as too heavy). A tap switches to the other. Shared by the
 * podium and New Releases so the two look and work the same.
 */
function ContentTypeToggle({
  value,
  onChange,
  style,
  pointerEvents,
}: {
  value: ContentType;
  onChange: (next: ContentType) => void;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none";
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        toggle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 34,
          paddingHorizontal: 12,
          borderRadius: 17,
          backgroundColor: colors.base200,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
      }),
    [colors]
  );
  return (
    <Pressable
      style={[styles.toggle, style]}
      onPress={() => onChange(value === "movie" ? "series" : "movie")}
      hitSlop={8}
      pointerEvents={pointerEvents}
      accessibilityRole="button"
      accessibilityLabel={value === "movie" ? t("Movie") : t("Series")}
    >
      <Ionicons name="film-outline" size={16} color={value === "movie" ? colors.primary : colors.placeholder} />
      <Ionicons name="tv-outline" size={16} color={value === "series" ? colors.primary : colors.placeholder} />
    </Pressable>
  );
}

export default memo(ContentTypeToggle);
