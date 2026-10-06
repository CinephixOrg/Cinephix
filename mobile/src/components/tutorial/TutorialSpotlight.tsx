import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  active: boolean;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const PULSE_MS = 600;

// Wraps any existing element (a tab bar, a search box, a button) with a
// looping fade-in/fade-out highlight border — generic on purpose, so the
// same component works for every step of a compose-tutorial walkthrough
// (PostComposeMenu.tsx's "+" categories, starting with Recommend) without
// having to teach each individual wrapped component about highlighting.
// Absolutely-positioned overlay, not a border on the children themselves —
// never changes their own layout/size, so wrapping something doesn't shift
// the rest of the screen even while the highlight is active.
export default function TutorialSpotlight({ active, borderRadius = 10, style, children }: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (!active) return;
    pulse.setValue(0.25);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: PULSE_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <View style={style}>
      {children}
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderWidth: 2.5, borderColor: colors.primary, borderRadius, opacity: pulse }]}
        />
      )}
    </View>
  );
}
