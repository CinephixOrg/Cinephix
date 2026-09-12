import { memo, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

export interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the icon's colour; defaults to the theme's body colour. */
  iconColor?: string;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Right-aligned value text, e.g. the current language. */
  value?: string;
  /** Renders a chevron and makes the row feel tappable. */
  chevron?: boolean;
  /** Anything to render at the trailing edge — a toggle, a spinner, a badge. */
  accessory?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Rows draw their own top divider; the first in a card passes false. */
  divider?: boolean;
}

// One line in a settings card.
//
// Press feedback is an opacity animation on the native driver rather than a
// background colour swap, so it stays at 60fps and needs no second colour in
// every palette.
function SettingsRow({
  icon,
  iconColor,
  label,
  description,
  value,
  chevron = false,
  accessory,
  onPress,
  disabled = false,
  destructive = false,
  divider = true,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const press = useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          paddingHorizontal: 15,
          paddingVertical: 14,
          borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.border,
        },
        plate: {
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base300,
        },
        body: { flex: 1, gap: 2 },
        label: {
          fontFamily: fonts.medium,
          fontSize: 15,
          color: destructive ? colors.error : colors.baseContent,
        },
        description: {
          fontFamily: fonts.regular,
          fontSize: 12,
          lineHeight: 16,
          color: colors.placeholder,
        },
        value: { fontFamily: fonts.regular, fontSize: 14, color: colors.placeholder, maxWidth: 150 },
        highlight: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.base300,
        },
      }),
    [colors, destructive, divider]
  );

  const animate = (toValue: number) =>
    Animated.timing(press, { toValue, duration: 110, useNativeDriver: true }).start();

  const content = (
    <>
      {icon ? (
        <View style={styles.plate}>
          <Ionicons
            name={icon}
            size={16}
            color={iconColor ?? (destructive ? colors.error : colors.baseContent)}
          />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.placeholder} /> : null}
    </>
  );

  // A row with no press handler is a container for its accessory (a toggle
  // handles its own touches), so it must not swallow those touches.
  if (!onPress) {
    return (
      <View style={[styles.row, disabled && { opacity: 0.5 }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View style={[styles.row, disabled && { opacity: 0.5 }]}>
        <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: press }]} />
        {content}
      </View>
    </Pressable>
  );
}

export default memo(SettingsRow);
