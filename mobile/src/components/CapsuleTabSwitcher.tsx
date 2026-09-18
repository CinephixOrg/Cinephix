import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
// Gesture handler's Pressable: see src/components/socials/MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
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
  // Optional pair: when these two options mirror pages of an external
  // horizontal pager, pass the pager's own raw scroll-offset Animated.Value
  // (in pixels, 0 at options[0] through pagerWidth at options[1]) so the
  // window slides in the same frame as the finger instead of only tweening
  // after the pager's page state commits (which reads as the pill trailing
  // behind a manual swipe). Home's Media switcher is the one consumer of
  // this; other callers (Profile's CineGraph toggle, Socials' Messages/
  // Community toggle) have no external drag to track and should leave both
  // unset, keeping the existing tap-triggered tween.
  dragOffsetX?: Animated.Value;
  pagerWidth?: number;
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
// label as text. Originally Home's Media header control (Paylaşımlar/
// Keşfet); every screen that needs this exact look/transition should use
// this component directly rather than re-implementing it — Home, Profile's
// CineGraph movie/series toggle, and Socials' Messages/Community toggle all
// render the identical thing this way.
//
// A drag-tracked per-slot width animation (each Pressable's own width
// interpolated toward its inactive/active size, alongside the window) was
// tried and reverted here: it caused the label text to render visibly
// truncated ("Shar…"/"Discov…") at rest, not just mid-drag — root cause
// never fully pinned down (suspected: the explicit `width` style and the
// natural onLayout-measured width not agreeing exactly once one starts
// driving the other), and a broken/truncated label is a worse regression
// than the residual stutter it was chasing. The window itself still tracks
// the drag continuously below; only each slot's *own* size is back to
// natural, content-driven sizing (a still-instant swap at the crossover,
// same as it's always been for the non-drag-tracked callers).
export default function CapsuleTabSwitcher<K extends string>({ options, activeKey, onChange, dragOffsetX, pagerWidth }: Props<K>) {
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
  // A slot's width depends on which content it's currently showing (label
  // text vs. icon-only) — so the instant `activeKey` flips mid-drag, both
  // slots' *rendered* content swaps immediately, but their onLayout
  // re-measurement only arrives a frame or two later (RN layout pass +
  // bridge round trip). In between, `layouts[key]` above is briefly stale
  // relative to what's actually on screen — invisible for the discrete
  // tween below, but it's what caused the drag-tracked *window* to visibly
  // freeze/misalign right at the swap and then "catch up" once the real
  // measurement landed. This cache sidesteps it: each option's own
  // *label-showing* geometry is captured once and reused forever after, so
  // the window's interpolation endpoints are always stable, already-known
  // values — never something that needs a fresh measurement mid-gesture.
  // (With exactly 2 mutually-exclusive options, "option A active" always
  // means "option B inactive", so each option's own active-state geometry
  // alone is enough to define the whole capsule's layout at both drag
  // endpoints — this is only about the *window*, not each slot's own size.)
  const [activeLayouts, setActiveLayouts] = useState<Partial<Record<K, SlotLayout>>>({});
  const windowX = useRef(new Animated.Value(0)).current;
  const windowWidth = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  // While dragOffsetX/pagerWidth are provided and both slots are measured,
  // the window is driven directly off the pager's live scroll position
  // instead — this discrete tween becomes dead weight in that mode (still
  // runs, just never rendered), left as-is rather than special-cased so the
  // tap-only consumers (Profile, Socials) keep their exact original path.
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

  const activeLayout0 = activeLayouts[options[0].key];
  const activeLayout1 = activeLayouts[options[1].key];
  // Only ready once *both* options have been the active/label-showing side
  // at least once — i.e. after the very first full switch in either
  // direction (option[1] starts icon-only, so its active geometry isn't
  // known until the user has actually landed on it once). Falls back to
  // the discrete tween until then; every swipe after that first one is
  // fully drag-tracked.
  const dragTracking = !!(dragOffsetX && pagerWidth && activeLayout0 && activeLayout1);
  const trackedX = dragTracking
    ? dragOffsetX!.interpolate({ inputRange: [0, pagerWidth!], outputRange: [activeLayout0!.x, activeLayout1!.x], extrapolate: "clamp" })
    : windowX;
  const trackedWidth = dragTracking
    ? dragOffsetX!.interpolate({ inputRange: [0, pagerWidth!], outputRange: [activeLayout0!.width, activeLayout1!.width], extrapolate: "clamp" })
    : windowWidth;

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
    // `activeKey` here is this render's own closed-over value, so it
    // correctly reflects what *this* onLayout event's measurement actually
    // corresponds to, even if activeKey has since changed again by the
    // time the callback fires.
    if (activeKey === key) {
      setActiveLayouts((prev) => {
        const existing = prev[key];
        if (existing && existing.x === x && existing.width === width) return prev;
        return { ...prev, [key]: { x, width } };
      });
    }
  };

  return (
    <View style={styles.capsule}>
      <Animated.View style={[styles.window, { width: trackedWidth, transform: [{ translateX: trackedX }] }]} />
      {options.map((option) => (
        <Pressable key={option.key} style={styles.slot} onLayout={handleSlotLayout(option.key)} onPress={() => onChange(option.key)}>
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
