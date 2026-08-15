import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, Text, Dimensions, Animated, PanResponder, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { SwipeCandidate, SwipeDecision } from "../../types";
import SwipeCard from "./SwipeCard";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const OFFSCREEN_DISTANCE = SCREEN_WIDTH * 1.5;
// How many cards render at once (top interactive one + this many peeking
// behind it) — kept small since each one is a full SwipeCard render.
const VISIBLE_STACK_SIZE = 3;

export interface SwipeCardStackHandle {
  swipeRight: () => void;
  swipeLeft: () => void;
}

interface Props {
  candidates: SwipeCandidate[];
  onSwipe: (candidate: SwipeCandidate, decision: SwipeDecision) => void;
  // Fires once when the visible queue is exhausted, so the screen can fetch
  // the next batch (newly-decided people are already excluded server-side).
  onEmpty: () => void;
  // Lets the screen know who's currently on top, for chrome that lives
  // outside the gesture area (a "View Profile" button) rather than a nested
  // tap target competing with the drag for the same touch.
  onTopCandidateChange?: (candidate: SwipeCandidate | null) => void;
  // Blocks both the drag and the imperative swipeLeft/swipeRight (e.g. once
  // the daily swipe limit is hit) — the screen also hides its own action
  // buttons in that state, this is defense in depth against a stray drag.
  disabled?: boolean;
}

// Built on PanResponder + the React Native core Animated API — deliberately
// not react-native-reanimated/react-native-worklets. Those need a native
// binary Expo Go doesn't ship for this SDK (see
// CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md / session history), so plain
// Expo Go can never run them without a custom dev client. PanResponder +
// Animated are React Native core — zero extra native modules, works in
// Expo Go unmodified. Everything here runs on the JS thread (no
// useNativeDriver) because PanResponder's per-touch updates aren't
// native-driver-eligible and an Animated.Value can't mix JS- and
// native-driven animations once created — simpler and fully correct beats
// the marginal smoothness native driving would have added.
function TopCard({
  candidate,
  onDecide,
  registerImperativeSwipe,
  disabled,
}: {
  candidate: SwipeCandidate;
  onDecide: (decision: SwipeDecision) => void;
  registerImperativeSwipe: (fn: (decision: SwipeDecision) => void) => void;
  disabled?: boolean;
}) {
  const pan = useRef(new Animated.ValueXY()).current;

  const animateOut = (decision: SwipeDecision) => {
    const toX = decision === "accept" ? OFFSCREEN_DISTANCE : -OFFSCREEN_DISTANCE;
    Animated.timing(pan, {
      toValue: { x: toX, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDecide(decision);
    });
  };

  // Exposes a programmatic trigger for the accept/reject buttons below the
  // stack, so they animate the exact same card the same way a real drag
  // would — no separate "button swipe" code path to keep in sync.
  useEffect(() => {
    registerImperativeSwipe(animateOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        !disabled && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (disabled) return;
        if (gesture.dx > SWIPE_THRESHOLD) {
          animateOut("accept");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          animateOut("reject");
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [10, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -10],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardSlot,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
      ]}
    >
      <SwipeCard candidate={candidate} />
      <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={[styles.stampText, styles.likeStampText]}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={[styles.stampText, styles.nopeStampText]}>NOPE</Text>
      </Animated.View>
    </Animated.View>
  );
}

const SwipeCardStack = forwardRef<SwipeCardStackHandle, Props>(function SwipeCardStack(
  { candidates, onSwipe, onEmpty, onTopCandidateChange, disabled },
  ref
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [topIndex, setTopIndex] = useState(0);
  const imperativeSwipeRef = useRef<((decision: SwipeDecision) => void) | null>(null);

  const emptyStyles = useMemo(
    () =>
      StyleSheet.create({
        empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
        emptyText: { color: colors.placeholder, fontSize: 15, textAlign: "center" },
      }),
    [colors]
  );

  const visible = candidates.slice(topIndex, topIndex + VISIBLE_STACK_SIZE);

  useEffect(() => {
    onTopCandidateChange?.(visible[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible[0]?.user._id]);

  const advance = (candidate: SwipeCandidate, decision: SwipeDecision) => {
    onSwipe(candidate, decision);
    const next = topIndex + 1;
    setTopIndex(next);
    if (next >= candidates.length) onEmpty();
  };

  useImperativeHandle(ref, () => ({
    swipeRight: () => !disabled && imperativeSwipeRef.current?.("accept"),
    swipeLeft: () => !disabled && imperativeSwipeRef.current?.("reject"),
  }));

  if (visible.length === 0) {
    return (
      <View style={emptyStyles.empty}>
        <Text style={emptyStyles.emptyText}>{t("No one new to show right now.")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stackContainer}>
      {visible
        .map((candidate, i) => ({ candidate, i }))
        .reverse()
        .map(({ candidate, i }) => {
          if (i === 0) {
            return (
              <TopCard
                key={candidate.user._id}
                candidate={candidate}
                onDecide={(decision) => advance(candidate, decision)}
                registerImperativeSwipe={(fn) => {
                  imperativeSwipeRef.current = fn;
                }}
                disabled={disabled}
              />
            );
          }
          return (
            <View
              key={candidate.user._id}
              pointerEvents="none"
              style={[
                styles.cardSlot,
                styles.stackedCard,
                {
                  transform: [{ scale: 1 - i * 0.04 }, { translateY: i * 10 }],
                  opacity: 1 - i * 0.25,
                },
              ]}
            >
              <SwipeCard candidate={candidate} />
            </View>
          );
        })}
    </View>
  );
});

export default SwipeCardStack;

const styles = StyleSheet.create({
  stackContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardSlot: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  stackedCard: {},
  stamp: {
    position: "absolute",
    top: 32,
    borderWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeStamp: { left: 24, borderColor: "#4ade80", transform: [{ rotate: "-18deg" }] },
  nopeStamp: { right: 24, borderColor: "#f87171", transform: [{ rotate: "18deg" }] },
  stampText: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: 2 },
  likeStampText: { color: "#4ade80" },
  nopeStampText: { color: "#f87171" },
});
