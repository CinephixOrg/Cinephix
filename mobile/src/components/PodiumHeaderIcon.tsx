import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
// Gesture handler's Pressable: see src/components/socials/MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import GradientIcon from "./GradientIcon";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";

const ICON_SIZE = 22;
// A "ring" is 3 quick alternating tilts (+/-/+) back to center — direct
// ask ("zil gibi çalsın... 3 defa"), not the original continuous slow
// wiggle, which read as too constant. RING_PHASE_MS is each tilt's own
// duration (snappy, bell-like, not the old graceful 900ms sine); RING_
// PAUSE_MS is the quiet gap between rings — direct ask again, a
// continuously-animating icon was judged distracting/annoying, so it
// rings periodically instead of nonstop.
const RING_PHASE_MS = 120;
const RING_PAUSE_MS = 5000;
const RING_DEG = 8;

// Replaces NotificationBell in Media's header (direct ask) — context-aware,
// routed by home/index.tsx itself (which knows the active outerTab) to
// whichever podium page matches: content-podium for Discover, people-
// podium for Shares. Gold gradient reuses TIER_FRAME_STYLES.premium's own
// pair — the same gold this app already uses everywhere else (avatar
// rings, ShareCard's Premium frame), not a new ad-hoc color choice.
export default function PodiumHeaderIcon({ onPress }: { onPress: () => void }) {
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ring = Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: RING_PHASE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: RING_PHASE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 1, duration: RING_PHASE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: RING_PHASE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(RING_PAUSE_MS),
    ]);
    const loop = Animated.loop(ring);
    loop.start();
    return () => loop.stop();
  }, [wiggle]);

  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: [`-${RING_DEG}deg`, `${RING_DEG}deg`] });

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.wrap}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <GradientIcon name="trophy" size={ICON_SIZE} colors={TIER_FRAME_STYLES.premium!.gradient} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ wrap: { marginRight: 12, padding: 4 } });
