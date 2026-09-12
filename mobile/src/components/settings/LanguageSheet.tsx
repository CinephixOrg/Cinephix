import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { changeLanguage } from "../../i18n";

// Native names — proper nouns, deliberately not translated, matching web's
// LanguageSwitcher.
//
// Flags are a country stand-in for a language, which is imprecise for the
// three that aren't tied to one: English, Arabic and Portuguese are marked
// with their most conventional choice. They degrade well — a device without
// flag glyphs renders the two regional-indicator letters instead ("TR"),
// which is exactly the language code that used to sit in that slot.
export const LANGUAGES: { code: string; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
];

const byCode = (code: string) => LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];

export const languageName = (code: string) => byCode(code).name;

// Used by the Settings row so the current language reads the same there as
// it does in the sheet.
export const languageLabel = (code: string) => {
  const language = byCode(code);
  return `${language.flag}  ${language.name}`;
};

// How far down you have to pull before letting go dismisses instead of
// springing back, and the flick speed that dismisses regardless of distance.
const DISMISS_FRACTION = 0.28;
const DISMISS_MIN_DISTANCE = 72;
const DISMISS_VELOCITY = 900;
// Only used until the sheet has measured itself.
const ASSUMED_SHEET_HEIGHT = 340;

interface Props {
  visible: boolean;
  onClose: () => void;
}

// The language picker: a bottom sheet that slides up, and that you can drag
// back down by its grab handle to dismiss.
//
// The drag is the vertical counterpart of the profile sidebar's swipe-to-
// close: a gesture-handler pan feeding an RN Animated value, with the
// enter/exit/settle animations all on the native driver. No reanimated.
function LanguageSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();

  const reveal = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  // Kept mounted through the exit animation — Modal unmounting on `visible`
  // alone makes the sheet vanish rather than slide away.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(ASSUMED_SHEET_HEIGHT);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(reveal, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 170,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        // Reset only once it is off screen, so a drag-dismissed sheet does
        // not snap back up on its way out.
        dragY.setValue(0);
      }
    });
    return () => animation.stop();
  }, [reveal, dragY, visible]);

  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    // Guarded: onLayout fires again on every re-render of the list, and an
    // unconditional setState there is a render loop waiting to happen.
    setSheetHeight((current) => (height > 0 && Math.abs(height - current) > 1 ? height : current));
  }, []);

  // A plain callback, deliberately not Animated.event.
  //
  // Animated.event(..., { useNativeDriver: true }) returns an AnimatedEvent
  // *object*, which only Animated components (Animated.ScrollView and the
  // like) know how to attach. Handing it to a gesture handler's
  // onGestureEvent makes Fabric try to call it as a listener and throw
  // "Expected onGestureHandlerEvent listener to be a function, instead got
  // a value of object type".
  //
  // setValue on an Animated.Value that is part of a native-driven graph
  // still updates the native node, so the sheet keeps following the finger
  // without the animation itself falling back to the JS driver.
  const onPanEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationY } = event.nativeEvent;
      // Clamped here rather than through an interpolation: a bottom sheet
      // has nowhere to go above its resting position.
      dragY.setValue(translationY > 0 ? translationY : 0);
    },
    [dragY]
  );

  const onPanStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState !== State.ACTIVE) return;
      const { translationY, velocityY } = event.nativeEvent;
      const threshold = Math.max(DISMISS_MIN_DISTANCE, sheetHeight * DISMISS_FRACTION);

      if (translationY > threshold || velocityY > DISMISS_VELOCITY) {
        // Carry it the rest of the way down under its own momentum, then
        // let the parent close it. Closing on release instead would cut the
        // gesture off mid-flight.
        Animated.timing(dragY, {
          toValue: sheetHeight,
          duration: 170,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) onClose();
        });
        return;
      }

      Animated.spring(dragY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }).start();
    },
    [dragY, onClose, sheetHeight]
  );

  const select = useCallback(
    async (code: string) => {
      // Closed first so the sheet animates out while i18next swaps the
      // resource bundle, rather than freezing mid-dismissal on the re-render
      // that a language change triggers across the whole tree.
      onClose();
      if (code !== i18n.language) await changeLanguage(code);
    },
    [onClose, i18n.language]
  );

  const { sheetTranslate, backdropOpacity } = useMemo(() => {
    // Enters from below the bottom of the screen, so the travel is the same
    // whatever the sheet's measured height turns out to be.
    const entrance = reveal.interpolate({
      inputRange: [0, 1],
      outputRange: [screenHeight, 0],
    });
    return {
      sheetTranslate: Animated.add(entrance, dragY),
      // The backdrop thins out as the sheet is pulled away, which is what
      // makes a half-finished drag read as "still holding it".
      backdropOpacity: Animated.multiply(
        reveal,
        dragY.interpolate({
          inputRange: [0, sheetHeight],
          outputRange: [1, 0],
          extrapolate: "clamp",
        })
      ),
    };
  }, [reveal, dragY, screenHeight, sheetHeight]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, justifyContent: "flex-end" },
        dim: { backgroundColor: "rgba(0,0,0,0.55)" },
        sheet: {
          backgroundColor: colors.base200,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: colors.border,
          paddingBottom: 28,
          maxHeight: "78%",
        },
        // The whole block is the drag target, not just the bar itself —
        // a 38x4 pixel grabber is far too small to aim at.
        handle: { paddingTop: 10, paddingBottom: 6 },
        grabber: {
          width: 38,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
        },
        header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
        title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent },
        subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, marginTop: 2 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        // Fixed width so every name starts on the same vertical line —
        // flag glyphs differ in advance width between platforms.
        flag: { fontSize: 22, width: 30, textAlign: "center" },
        name: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent, flex: 1 },
        nameActive: { color: colors.primary, fontFamily: fonts.bold },
      }),
    [colors]
  );

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* RN's Modal renders into its own detached native root, outside the
          app-root GestureHandlerRootView (app/_layout.tsx) — without a
          second one here the pan handler below never receives touches. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.dim, { opacity: backdropOpacity }]}
          />
          {/* Tapping the dimmed area dismisses; the sheet itself must not. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
          />

          <Animated.View
            onLayout={onSheetLayout}
            style={[styles.sheet, { transform: [{ translateY: sheetTranslate }] }]}
          >
            <PanGestureHandler onGestureEvent={onPanEvent} onHandlerStateChange={onPanStateChange}>
              {/* Only the handle drags. Putting it on the whole sheet would
                  fight the language list's own scrolling. */}
              <View>
                <View style={styles.handle} accessible={false}>
                  <View style={styles.grabber} />
                </View>
                <View style={styles.header}>
                  <Text style={styles.title}>{t("Language")}</Text>
                  <Text style={styles.subtitle}>{t("Changes apply across the app right away")}</Text>
                </View>
              </View>
            </PanGestureHandler>

            <ScrollView bounces={false}>
              {LANGUAGES.map((language) => {
                const active = language.code === i18n.language;
                return (
                  <Pressable
                    key={language.code}
                    style={styles.row}
                    onPress={() => select(language.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.flag}>{language.flag}</Text>
                    <Text style={[styles.name, active && styles.nameActive]}>{language.name}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default memo(LanguageSheet);
