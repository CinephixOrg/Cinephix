import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { PALETTES, THEME_NAMES } from "../../theme/palettes";
import type { ThemeName } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

interface SwatchProps {
  name: ThemeName;
  active: boolean;
  onSelect: (name: ThemeName) => void;
}

// One theme, previewed with its own palette rather than the active one — the
// point of the control is to show what each theme looks like, so these
// colours are deliberately not themed.
const ThemeSwatch = memo(function ThemeSwatch({ name, active, onSelect }: SwatchProps) {
  const { colors } = useTheme();
  const palette = PALETTES[name];
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [lift, active]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: 104,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: palette.base100,
          overflow: "hidden",
        },
        preview: { height: 54, padding: 9, gap: 6, justifyContent: "center" },
        bar: { height: 6, borderRadius: 3, backgroundColor: palette.primary, width: "70%" },
        bar2: { height: 6, borderRadius: 3, backgroundColor: palette.secondary, width: "45%" },
        dots: { flexDirection: "row", gap: 4, marginTop: 1 },
        dot: { width: 7, height: 7, borderRadius: 4 },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 9,
          paddingVertical: 7,
          backgroundColor: palette.base200,
        },
        name: {
          fontFamily: fonts.medium,
          fontSize: 12,
          color: palette.baseContent,
          textTransform: "capitalize",
          flex: 1,
        },
      }),
    [colors, palette, active]
  );

  return (
    <Animated.View style={{ transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>
      <Pressable
        style={styles.card}
        onPress={() => onSelect(name)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={name}
      >
        <View style={styles.preview}>
          <View style={styles.bar} />
          <View style={styles.bar2} />
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: palette.accent }]} />
            <View style={[styles.dot, { backgroundColor: palette.secondary }]} />
            <View style={[styles.dot, { backgroundColor: palette.primary }]} />
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {active ? <Ionicons name="checkmark-circle" size={14} color={palette.primary} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});

// Laid out as a horizontal strip rather than a grid: nine themes as a
// two-column grid is five rows of cards, which dominates the page for a
// control most people touch once.
function ThemePicker() {
  const { themeName, setTheme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      // The strip lives inside a card with its own padding; bleeding to the
      // edges would look like a mistake rather than an affordance.
      keyboardShouldPersistTaps="handled"
    >
      {THEME_NAMES.map((name) => (
        <ThemeSwatch key={name} name={name} active={name === themeName} onSelect={setTheme} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 10, paddingHorizontal: 15, paddingVertical: 14 },
});

export default memo(ThemePicker);
