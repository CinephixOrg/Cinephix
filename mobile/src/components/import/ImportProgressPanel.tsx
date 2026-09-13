import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { ImportProgress } from "../../types";

const PHASES: { key: ImportProgress["phase"]; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "extract", label: "Reading", icon: "folder-open-outline" },
  { key: "normalize", label: "Normalizing", icon: "swap-horizontal-outline" },
  { key: "match", label: "Matching", icon: "git-compare-outline" },
  { key: "lookup", label: "Looking up", icon: "search-outline" },
  { key: "save", label: "Saving", icon: "save-outline" },
];

interface Props {
  progress: ImportProgress | null;
}

// The four-stage pipeline, made visible. The server names the phase it is in
// and, where it can, how far through it is; the bar is determinate when a
// total is known and a sweeping indeterminate otherwise.
export default function ImportProgressPanel({ progress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const activeIndex = Math.max(
    0,
    PHASES.findIndex((phase) => phase.key === progress?.phase)
  );
  const ratio =
    progress?.total && progress.total > 0 ? Math.min(1, (progress.current ?? 0) / progress.total) : null;

  // Width rather than scaleX: this is one small view, and anchoring a scaled
  // bar to its left edge costs more complexity than the non-native driver
  // does here.
  const fill = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Each phase owns a slice of the bar, and a known ratio moves within it,
    // so the bar always advances and never jumps backwards between phases.
    const slice = 1 / PHASES.length;
    const base = activeIndex * slice;
    const target = ratio === null ? base + slice * 0.55 : base + slice * ratio;
    Animated.timing(fill, {
      toValue: target,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, activeIndex, ratio]);

  useEffect(() => {
    // A shimmer that only runs while the length is unknown, so a determinate
    // bar isn't competing with a second moving thing.
    if (ratio !== null) {
      sweep.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    sweep.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [sweep, ratio]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.base200,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 14,
        },
        header: { flexDirection: "row", alignItems: "center", gap: 10 },
        title: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, flex: 1 },
        counter: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        track: {
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.base300,
          overflow: "hidden",
        },
        fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
        shimmer: {
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "35%",
          backgroundColor: colors.primaryContent,
          opacity: 0.25,
        },
        steps: { flexDirection: "row", justifyContent: "space-between" },
        step: { alignItems: "center", gap: 5, flex: 1 },
        stepLabel: { fontFamily: fonts.medium, fontSize: 10, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
        <Text style={styles.title} numberOfLines={1}>
          {progress?.text || t("Starting…")}
        </Text>
        {ratio !== null && (
          <Text style={styles.counter}>
            {progress?.current ?? 0}/{progress?.total ?? 0}
          </Text>
        )}
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        >
          {ratio === null && (
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [
                    { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-60, 240] }) },
                  ],
                },
              ]}
            />
          )}
        </Animated.View>
      </View>

      <View style={styles.steps}>
        {PHASES.map((phase, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const color = done ? colors.success : active ? colors.primary : colors.placeholder;
          return (
            <View key={phase.key} style={styles.step}>
              <Ionicons name={done ? "checkmark-circle" : phase.icon} size={16} color={color} />
              <Text style={[styles.stepLabel, { color }]} numberOfLines={1}>
                {t(phase.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
