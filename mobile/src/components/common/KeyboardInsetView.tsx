import { useCallback, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaFrame } from "react-native-safe-area-context";

const ANDROID = Platform.OS === "android";

/**
 * Keeps its content clear of the keyboard on Android, moving with the
 * keyboard frame by frame as it opens and closes.
 *
 * Android apps are edge-to-edge now (mandatory since Android 16), and an
 * edge-to-edge window no longer shrinks when the keyboard opens: the keyboard
 * is drawn over the bottom of the screen instead, hiding whatever sits there
 * (a chat's composer, the lower half of a form). This pads its content by the
 * part of the keyboard that actually covers it. The keyboard height comes from
 * Reanimated on every frame of the keyboard's own animation — RN's Keyboard
 * events only arrive once it has finished, which made the content jump up
 * after the keyboard instead of travelling with it.
 *
 * "Actually covers": Reanimated's keyboard height runs from the top of the
 * keyboard to the bottom of the app's root view, so whatever lies between
 * this view and that edge (a tab bar) is taken off. Both sides of that sum are
 * in the root view's coordinates — measureInWindow is relative to the root
 * view, and the root view is the safe-area frame — which keeps it right where
 * the root view doesn't start at the top of the screen (Expo Go). The gap is
 * measured again whenever this view's frame changes: the tab bar hides once
 * the keyboard is up, and the view grows into its place.
 *
 * iOS screens keep their KeyboardAvoidingView, so this adds nothing there.
 */
export default function KeyboardInsetView({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<View>(null);
  const keyboard = useAnimatedKeyboard();
  const rootHeight = useSafeAreaFrame().height;
  // From this view's bottom edge down to the bottom of the root view.
  const gap = useSharedValue(0);

  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, height) => {
      // Ignore a frame that's still being drawn.
      if (!height) return;
      gap.value = Math.max(rootHeight - (y + height), 0);
    });
  }, [gap, rootHeight]);

  const padding = useAnimatedStyle(() => ({
    paddingBottom: ANDROID ? Math.max(keyboard.height.value - gap.value, 0) : 0,
  }));

  // The padding goes on an inner view so this one's frame — what's measured —
  // doesn't change with it.
  return (
    <View ref={ref} onLayout={onLayout} style={style}>
      <Animated.View style={[styles.fill, padding]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
