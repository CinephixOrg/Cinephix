import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
// The header button is gesture handler's Pressable (see MessagesSection.tsx
// for why); the menu inside the Modal keeps React Native's, since a freshly
// opened Modal measures correctly and gesture handler needs its own root there.
import { Pressable as HeaderPressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { localeUpper } from "../../utils/text";
import { placePopover, type AnchorRect } from "../../utils/popover";
import { isDarkTheme } from "./communityCategory";

const MENU_WIDTH = 272;
const CARET = 12;

type Colors = ReturnType<typeof useTheme>["colors"];

export function createPopoverStyles(colors: Colors, dark: boolean, screenWidth: number) {
  return StyleSheet.create({
    button: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: 2,
      right: 1,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.base200,
    },
    badgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primaryContent },
    menu: {
      position: "absolute",
      width: Math.min(MENU_WIDTH, screenWidth - 24),
      borderRadius: 20,
      paddingTop: 14,
      paddingBottom: 8,
      backgroundColor: colors.base100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: dark ? 0.5 : 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    caret: {
      position: "absolute",
      top: -CARET / 2,
      width: CARET,
      height: CARET,
      backgroundColor: colors.base100,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      transform: [{ rotate: "45deg" }],
    },
    // Shared by the menus' contents.
    label: {
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 0.9,
      color: colors.placeholder,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    hint: { fontSize: 12, lineHeight: 16.5, color: colors.placeholder, paddingHorizontal: 16, marginTop: 4, marginBottom: 2 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      height: 44,
      marginHorizontal: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    optionPressed: { backgroundColor: colors.base200 },
    optionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
    optionTextActive: { fontFamily: fonts.bold },
    optionCount: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, minWidth: 16, textAlign: "right" },
    check: { width: 18, alignItems: "flex-end" },
    priority: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    priorityText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.primaryContent },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 6, marginHorizontal: 16 },
    reset: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, marginTop: 4 },
    resetText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
  });
}

export type PopoverStyles = ReturnType<typeof createPopoverStyles>;

export function usePopoverStyles() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dark = isDarkTheme(colors);
  const styles = useMemo(() => createPopoverStyles(colors, dark, width), [colors, dark, width]);
  return { styles, colors, dark };
}

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  /** The button's accessibility label. */
  label: string;
  /** Shown as a badge on the button, and tints its icon, when above 0. */
  count: number;
  children: ReactNode;
}

// A header icon that drops a small menu straight down from itself — the
// Communities Filter and Sort menus. Opens with a quick spring from the
// button, closes a little faster, and a tap anywhere outside closes it.
// Choices inside apply the moment they're tapped, so the list underneath
// updates live while the menu stays open.
function HeaderPopover({ icon, label, count, children }: Props) {
  const { styles, colors } = usePopoverStyles();
  const { width: screenWidth } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const show = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!anchor) return;
    const animation = open
      ? Animated.spring(progress, { toValue: 1, speed: 22, bounciness: 5, useNativeDriver: true })
      : Animated.timing(progress, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && !open) setAnchor(null);
    });
    return () => animation.stop();
  }, [open, anchor, progress]);

  const placement = anchor ? placePopover(anchor, screenWidth, MENU_WIDTH) : null;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const { t } = useTranslation();

  return (
    <>
      <HeaderPressable
        ref={anchorRef}
        onPress={show}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.button, (pressed || open) && { backgroundColor: colors.base300 }]}
      >
        <Ionicons name={icon} size={22} color={count > 0 ? colors.primary : colors.baseContent} />
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
      </HeaderPressable>

      {anchor && placement ? (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={hide}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityRole="button" accessibilityLabel={t("Close")} />
          <Animated.View
            style={[
              styles.menu,
              {
                top: placement.top,
                left: placement.left,
                opacity: progress,
                transform: [{ translateY }, { scale }],
                transformOrigin: placement.align === "left" ? "top left" : "top right",
              },
            ]}
          >
            <View style={[styles.caret, { left: placement.caretX - CARET / 2 }]} />
            {children}
          </Animated.View>
        </Modal>
      ) : null}
    </>
  );
}

export default memo(HeaderPopover);

/** A section heading inside a menu, uppercased for the app's language. */
export function PopoverLabel({ text, styles }: { text: string; styles: PopoverStyles }) {
  return <Text style={styles.label}>{localeUpper(text)}</Text>;
}

/** The menu's closing "undo everything here" action, under a hairline. */
export function PopoverReset({ label, onPress, styles, colors }: { label: string; onPress: () => void; styles: PopoverStyles; colors: Colors }) {
  return (
    <>
      <View style={styles.divider} />
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.reset, pressed && { opacity: 0.6 }]}>
        <Ionicons name="refresh" size={15} color={colors.primary} />
        <Text style={styles.resetText}>{label}</Text>
      </Pressable>
    </>
  );
}
