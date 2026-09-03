import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

// A soft top-to-bottom fade-in, replaying every time `activeKey` changes to
// a new truthy value (not just the first time it becomes truthy) — the
// standard "reveal a detail panel for whichever thing is currently
// selected" animation used across the match-analysis panel (radar chart
// category descriptions, shared-genre poster ratings). Extracted once both
// needed the exact same behavior rather than duplicating it.
export function useRevealAnimation(activeKey: string | null, durationMs = 480, slideDistance = 10) {
  const anim = useRef(new Animated.Value(0)).current;
  // Memoized, not a fresh `anim.interpolate(...)` call every render —
  // interpolate() returns a new object each time it's called, so an inline
  // call here would silently hand callers a new `translateY` reference on
  // every single render regardless of whether anything actually changed.
  // MatchAnalysisPanel's `cards` useMemo lists this value in its own
  // dependency array, so an unstable reference here was defeating that
  // memoization entirely, forcing it to rebuild on every render.
  const translateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [-slideDistance, 0] }),
    [anim, slideDistance]
  );

  useEffect(() => {
    if (activeKey) {
      // A new truthy key (including switching between two different ones)
      // always replays the reveal from scratch, not just crossfades from
      // wherever the value currently sits.
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Previously a no-op: this branch didn't exist, so `anim` just froze
      // at whatever value it last reached instead of animating back down.
      // Harmless while the caller's own JSX unmounts the revealed content
      // outright on hide (nothing stays on screen to show the stale value),
      // but real, visible staleness anywhere that instead keeps the same
      // node mounted and only toggles this opacity — confirmed live: rapid
      // repeated taps toggling a `showAllGenres`-style boolean could catch
      // this value mid-flight and leave content looking stuck partially
      // visible behind whatever should have replaced it.
      Animated.timing(anim, {
        toValue: 0,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return { opacity: anim, translateY };
}
