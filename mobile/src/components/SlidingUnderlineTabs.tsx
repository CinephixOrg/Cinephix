import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

export interface TabItem {
  key: string;
  label: string;
}

interface Props {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

const ANIM_MS = 220;

// A tab bar whose selection indicator is a single underline that actually
// slides between tabs (Animated.timing on both its x position and width)
// instead of an instant swap of which tab's own bottom border happens to
// be turned on — direct ask ("kayma animasyonunu görmek istiyorum"),
// reused by both Search's own main filter (movies/series/reviews/lists/
// users) and Content Detail's Reviews filter so both animate identically.
// Layout-driven (left/width aren't native-driver-eligible props), but this
// only ever animates on a deliberate tap, never a scroll — fine to run on
// the JS thread.
export default function SlidingUnderlineTabs({ tabs, activeKey, onChange }: Props) {
  const { colors } = useTheme();
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);

  const animateTo = (key: string, instant: boolean) => {
    const layout = layoutsRef.current[key];
    if (!layout) return;
    if (instant) {
      underlineX.setValue(layout.x);
      underlineWidth.setValue(layout.width);
      return;
    }
    Animated.parallel([
      Animated.timing(underlineX, { toValue: layout.x, duration: ANIM_MS, useNativeDriver: false }),
      Animated.timing(underlineWidth, { toValue: layout.width, duration: ANIM_MS, useNativeDriver: false }),
    ]).start();
  };

  // Covers both a tap on this bar's own Pressables (handlePress below) and
  // `activeKey` changing for some other reason (a parent controlling it
  // directly, e.g. a deep link landing on a non-default tab) — either way
  // the underline should end up under the right tab.
  useEffect(() => {
    if (!layoutsRef.current[activeKey]) return;
    animateTo(activeKey, !measured);
    if (!measured) setMeasured(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, measured]);

  const onTabLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutsRef.current[key] = { x, width };
    if (key === activeKey && !measured) {
      animateTo(key, true);
      setMeasured(true);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.base300,
        },
        button: { flex: 1, alignItems: "center", paddingVertical: 12 },
        text: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        textActive: { color: colors.primary, fontFamily: fonts.bold },
        underline: { position: "absolute", bottom: 0, height: 2, backgroundColor: colors.primary },
      }),
    [colors]
  );

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => (
        <Pressable key={tab.key} style={styles.button} onLayout={onTabLayout(tab.key)} onPress={() => onChange(tab.key)}>
          <Text style={[styles.text, activeKey === tab.key && styles.textActive]}>{tab.label}</Text>
        </Pressable>
      ))}
      <Animated.View style={[styles.underline, { transform: [{ translateX: underlineX }], width: underlineWidth }]} />
    </View>
  );
}
