import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

export type CineGraphSubTab = "movie" | "series";
type SlotLayout = { x: number; width: number };

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Same capsule-switcher design/mechanics as Medya's Paylaşımlar/Keşfet
// control (MedyaTabSwitcher in home/index.tsx) — content-hugging pill,
// muted-gray translucent background, a real sliding Animated.View window
// measured off each slot's own onLayout, active slot shows text, inactive
// shows an icon. Shared by both ProfileCategoryTabs.tsx (own profile, 4
// icons) and PublicProfileCategoryTabs.tsx (someone else's, 2 icons) — each
// parent renders it centered below its own category icon row (movie/series
// only, the CineGraph icon itself is plain and not part of this shape).
export default function CineGraphSubTabSwitcher({ activeTab, onChange }: { activeTab: CineGraphSubTab; onChange: (tab: CineGraphSubTab) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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

  const [layouts, setLayouts] = useState<Partial<Record<CineGraphSubTab, SlotLayout>>>({});
  const windowX = useRef(new Animated.Value(0)).current;
  const windowWidth = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  useEffect(() => {
    const target = layouts[activeTab];
    if (!target) return;
    if (!measured.current) {
      windowX.setValue(target.x);
      windowWidth.setValue(target.width);
      measured.current = true;
      return;
    }
    Animated.parallel([
      Animated.timing(windowX, { toValue: target.x, duration: 260, useNativeDriver: false }),
      Animated.timing(windowWidth, { toValue: target.width, duration: 260, useNativeDriver: false }),
    ]).start();
  }, [activeTab, layouts]);

  const handleSlotLayout = (tab: CineGraphSubTab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [tab]: { x, width } }));
  };

  return (
    <View style={styles.capsule}>
      <Animated.View style={[styles.window, { width: windowWidth, transform: [{ translateX: windowX }] }]} />
      <Pressable style={styles.slot} onLayout={handleSlotLayout("movie")} onPress={() => onChange("movie")}>
        {activeTab === "movie" ? (
          <Text style={styles.slotText}>{t("Movies")}</Text>
        ) : (
          <Ionicons name="film-outline" size={16} color={colors.placeholder} />
        )}
      </Pressable>
      <Pressable style={styles.slot} onLayout={handleSlotLayout("series")} onPress={() => onChange("series")}>
        {activeTab === "series" ? (
          <Text style={styles.slotText}>{t("Series")}</Text>
        ) : (
          <Ionicons name="tv-outline" size={16} color={colors.placeholder} />
        )}
      </Pressable>
    </View>
  );
}
