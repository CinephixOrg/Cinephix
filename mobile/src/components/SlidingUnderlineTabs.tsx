import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import Pressable from "./common/TapSafePressable";
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
  // Compose-tutorial only (Search's Movies/Series step) — pulses a
  // highlight border around just these tabs by key, not the whole bar, so a
  // guided walkthrough can point at "Movies"/"Series" specifically without
  // implying Reviews/Lists/Users need attention too. Optional and additive:
  // every other call site (Socials, Content Detail's Reviews filter) is
  // unaffected. Reuses the same per-tab {x, width} this component already
  // tracks for its own sliding underline, rather than a second measurement
  // pass.
  highlightKeys?: string[];
}

const ANIM_MS = 220;
const PULSE_MS = 600;

// A tab bar whose selection indicator is a single underline that actually
// slides between tabs (Animated.timing on both its x position and width)
// instead of an instant swap of which tab's own bottom border happens to
// be turned on — direct ask ("kayma animasyonunu görmek istiyorum"),
// reused by both Search's own main filter (movies/series/reviews/lists/
// users) and Content Detail's Reviews filter so both animate identically.
// Layout-driven (left/width aren't native-driver-eligible props), but this
// only ever animates on a deliberate tap, never a scroll — fine to run on
// the JS thread.
export default function SlidingUnderlineTabs({ tabs, activeKey, onChange, highlightKeys }: Props) {
  const { colors } = useTheme();
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  // layoutsRef alone (a ref) doesn't trigger a re-render once a highlighted
  // tab's own layout comes in — the underline doesn't need that (it's
  // positioned imperatively via Animated.Value), but the highlight overlay
  // below needs real left/width style values, so those specific
  // measurements also land in state.
  const [highlightLayouts, setHighlightLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const hasHighlight = !!highlightKeys && highlightKeys.length > 0;
  const pulse = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (!hasHighlight) return;
    pulse.setValue(0.25);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: PULSE_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasHighlight, pulse]);

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
    if (highlightKeys?.includes(key)) {
      setHighlightLayouts((prev) => ({ ...prev, [key]: { x, width } }));
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
        highlight: { position: "absolute", top: 4, bottom: 4, borderWidth: 2, borderColor: colors.primary, borderRadius: 8 },
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
      {hasHighlight &&
        highlightKeys!.map((key) => {
          const layout = highlightLayouts[key];
          if (!layout) return null;
          return (
            <Animated.View
              key={`highlight-${key}`}
              pointerEvents="none"
              style={[styles.highlight, { left: layout.x, width: layout.width, opacity: pulse }]}
            />
          );
        })}
    </View>
  );
}
