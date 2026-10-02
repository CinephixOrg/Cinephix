import { useEffect, useRef } from "react";
import { Keyboard, Platform } from "react-native";
import { useNavigation } from "expo-router";

// Longest we'll hold a Back press waiting for the keyboard to finish hiding.
const HIDE_TIMEOUT_MS = 350;

/**
 * Takes the keyboard down before this screen goes away.
 *
 * Leaving a screen with the keyboard still up (typing in a chat, then Back)
 * left the screen underneath unresponsive on Android: the page transition and
 * the keyboard's own hide animation ran at the same time, and taps on the
 * previous screen were lost afterwards. So on Android, a removal while the
 * keyboard is open is held until the keyboard has hidden, then carried out.
 * iOS can't hold a swipe-back that's already under way, so there it's just
 * dismissed as the screen leaves.
 *
 * Switching tabs away from the screen dismisses it too.
 */
export function useKeyboardSafeExit() {
  const navigation = useNavigation();
  const leavingRef = useRef(false);

  useEffect(() => {
    const offRemove = navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current || !Keyboard.isVisible()) return;
      if (Platform.OS !== "android") {
        Keyboard.dismiss();
        return;
      }
      event.preventDefault();
      leavingRef.current = true;
      let done = false;
      const proceed = () => {
        if (done) return;
        done = true;
        subscription.remove();
        clearTimeout(timer);
        navigation.dispatch(event.data.action);
      };
      const subscription = Keyboard.addListener("keyboardDidHide", proceed);
      const timer = setTimeout(proceed, HIDE_TIMEOUT_MS);
      Keyboard.dismiss();
    });
    const offBlur = navigation.addListener("blur", () => Keyboard.dismiss());
    return () => {
      offRemove();
      offBlur();
    };
  }, [navigation]);
}
