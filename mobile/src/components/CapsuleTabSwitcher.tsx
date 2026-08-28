import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

type SlotLayout = { x: number; width: number };

export interface CapsuleTabOption<K extends string> {
  key: K;
  // Pre-translated by the caller — keeps this component i18n-agnostic
  // rather than coupling it to a specific translation-key shape.
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props<K extends string> {
  options: [CapsuleTabOption<K>, CapsuleTabOption<K>];
  activeKey: K;
  onChange: (key: K) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The app's one shared "content-hugging 2-way pill switcher" — small
// capsule, muted-gray translucent background, a real sliding Animated.View
// window measured off each slot's own onLayout (not just a background-color
// swap). The inactive side shows only its icon; the active side shows its
// label as text. Originally Home's Medya header control (Paylaşımlar/
// Keşfet); every screen that needs this exact look/transition should use
// this component directly rather than re-implementing it — Home, Profile's
// CineGraph movie/series toggle, and Socials' Messages/Community toggle all
// render the identical thing this way.
export default function CapsuleTabSwitcher<K extends string>({ options, activeKey, onChange }: Props<K>) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        capsule: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: hexToRgba(colors.placeholder, 0.16),
          borderRadius: 999,
          padding: 4,
          position: "relative",
        },
        window: {
          position: "absolute",
          top: 4,
          bottom: 4,
          borderRadius: 999,
          backgroundColor: hexToRgba(colors.placeholder, 0.5),
        },
        slot: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 14,
          paddingVertical: 7,
        },
        slotText: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
      }),
    [colors]
  );

  const [layouts, setLayouts] = useState<Partial<Record<K, SlotLayout>>>({});
  const windowX = useRef(new Animated.Value(0)).current;
  const windowWidth = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  useEffect(() => {
    const target = layouts[activeKey];
    if (!target) return;
    if (!measured.current) {
      // First-ever measurement — snap into place, no grow-from-0 animation.
      windowX.setValue(target.x);
      windowWidth.setValue(target.width);
      measured.current = true;
      return;
    }
    Animated.parallel([
      Animated.timing(windowX, { toValue: target.x, duration: 260, useNativeDriver: false }),
      Animated.timing(windowWidth, { toValue: target.width, duration: 260, useNativeDriver: false }),
    ]).start();
  }, [activeKey, layouts]);

  // Rounded + no-op-guarded: committing every onLayout event verbatim,
  // including sub-pixel noise around an already-stored value, restarts the
  // slide animation toward an imperceptibly different target every time
  // this re-renders, which reads as jitter.
  const handleSlotLayout = (key: K) => (e: LayoutChangeEvent) => {
    const x = Math.round(e.nativeEvent.layout.x);
    const width = Math.round(e.nativeEvent.layout.width);
    setLayouts((prev) => {
      const existing = prev[key];
      if (existing && existing.x === x && existing.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  };

  return (
    <View style={styles.capsule}>
      <Animated.View style={[styles.window, { width: windowWidth, transform: [{ translateX: windowX }] }]} />
      {options.map((option) => (
        <Pressable
          key={option.key}
          style={styles.slot}
          onLayout={handleSlotLayout(option.key)}
          onPress={() => onChange(option.key)}
        >
          {activeKey === option.key ? (
            <Text style={styles.slotText}>{option.label}</Text>
          ) : (
            <Ionicons name={option.icon} size={16} color={colors.placeholder} />
          )}
        </Pressable>
      ))}
    </View>
  );
}
