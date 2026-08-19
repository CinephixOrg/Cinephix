import { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import SharesFeedSection from "../../../src/components/home/SharesFeedSection";
import KesfetSection from "../../../src/components/home/KesfetSection";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type OuterTab = "shares" | "discover";
type SlotLayout = { x: number; width: number };

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Small pill-shaped, content-hugging 2-way switcher living inside the
// header itself (centered between the logo and notification bell). The
// inactive side shows only its icon; the active side shows the page name
// as text. A real separate "window" (an Animated.View, not just a
// background-color swap) slides and resizes to match the active slot's own
// measured position/width — genuine continuous motion, not an instant
// color flip. Muted gray throughout (derived from the theme's own
// `placeholder` tone, not a saturated brand color) per explicit request.
function MedyaTabSwitcher({ activeTab, onChange }: { activeTab: OuterTab; onChange: (tab: OuterTab) => void }) {
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

  const [layouts, setLayouts] = useState<Partial<Record<OuterTab, SlotLayout>>>({});
  const windowX = useRef(new Animated.Value(0)).current;
  const windowWidth = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  useEffect(() => {
    const target = layouts[activeTab];
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
  }, [activeTab, layouts]);

  const handleSlotLayout = (tab: OuterTab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [tab]: { x, width } }));
  };

  return (
    <View style={styles.capsule}>
      <Animated.View style={[styles.window, { width: windowWidth, transform: [{ translateX: windowX }] }]} />
      <Pressable style={styles.slot} onLayout={handleSlotLayout("shares")} onPress={() => onChange("shares")}>
        {activeTab === "shares" ? (
          <Text style={styles.slotText}>{t("Paylaşımlar")}</Text>
        ) : (
          <Ionicons name="grid-outline" size={16} color={colors.placeholder} />
        )}
      </Pressable>
      <Pressable style={styles.slot} onLayout={handleSlotLayout("discover")} onPress={() => onChange("discover")}>
        {activeTab === "discover" ? (
          <Text style={styles.slotText}>{t("Keşfet")}</Text>
        ) : (
          <Ionicons name="compass-outline" size={16} color={colors.placeholder} />
        )}
      </Pressable>
    </View>
  );
}

// Medya's shell: Paylaşımlar (new social feed) | Keşfet (the former entire
// Home tab, moved verbatim into KesfetSection.tsx). Same lazy-mount-then-
// display:none pattern KesfetSection's own inner tabs (and Search's/
// Socials' outer shells) already use.
export default function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    hidden: { display: "none" },
  }), [colors]);

  const [outerTab, setOuterTab] = useState<OuterTab>("shares");
  const [visitedTabs, setVisitedTabs] = useState<Set<OuterTab>>(() => new Set(["shares"]));

  const switchTab = (tab: OuterTab) => {
    setOuterTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <MedyaTabSwitcher activeTab={outerTab} onChange={switchTab} />,
    });
  }, [navigation, outerTab]);

  return (
    <View style={styles.container}>
      <View style={[{ flex: 1 }, outerTab !== "shares" && styles.hidden]}>
        {visitedTabs.has("shares") && <SharesFeedSection />}
      </View>
      <View style={[{ flex: 1 }, outerTab !== "discover" && styles.hidden]}>
        {visitedTabs.has("discover") && <KesfetSection />}
      </View>
    </View>
  );
}
