import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MatchAvatarRing from "./MatchAvatarRing";
import { useTheme } from "../../context/ThemeContext";
import type { SyncCandidate } from "../../types";

// Idle "still floating" drift — deliberately much slower/gentler than every
// other animation in this feature (1300ms moves, 700ms fills): a small
// amplitude, long random-duration segments, sine easing so it never has a
// sharp direction change.
const BOB_AMPLITUDE = 6;
const BOB_MIN_MS = 1800;
const BOB_MAX_MS = 3200;
// How often the connecting lines' endpoint is allowed to update from the
// bob animation's live value — this motion is slow/subtle enough that a
// throttled sync is visually indistinguishable from a per-frame one, at a
// fraction of the JS-thread/bridge cost (uncapped, this was the real source
// of the app-wide sluggishness reported after this feature shipped, not the
// dotted line's own rendering).
const LINE_SYNC_THROTTLE_MS = 120;
// A past round of this card explicitly rejected a grow/slide-left treatment
// in favor of a border highlight — this round reverses that call per an
// explicit new instruction: the border "didn't look nice," replaced with a
// smooth grow instead. selectedScale (passed in by MatchResultsCloud, which
// already knows this bubble's own diameter and the layout's guaranteed
// minimum edge-to-edge gap to its neighbors) keeps the growth small enough
// to never overlap another bubble, by construction.
const SELECT_SCALE_MS = 280;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

interface Props {
  candidate: SyncCandidate;
  x: number;
  y: number;
  diameter: number;
  rank: number;
  // bobAnim drives this bubble's own idle drift (native-driven, smooth).
  // lineBobAnim mirrors it on the JS thread, throttled, purely so
  // MatchResultsCloud's connecting lines — a separate native component the
  // native driver can't reach — can track the same motion without forcing
  // the bubble's own visible movement onto the JS thread too. Both owned by
  // the parent, not created here.
  bobAnim: Animated.ValueXY;
  lineBobAnim: Animated.ValueXY;
  // A stable (id) => void callback owned by the parent, not a pre-bound
  // () => void — MatchResultsCloud passes the exact same function
  // reference on every render (useCallback with an empty dep array), which
  // is what actually lets this component's own React.memo below take
  // effect; a fresh closure per bubble per render would defeat it.
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  // (diameter + a small fixed pixel growth) / diameter — see MatchResultsCloud's
  // own doc comment for why this is a per-bubble pixel-bounded scale, not one
  // flat percentage shared by every rank.
  selectedScale: number;
  // Tier-gated bubble (Free's #1, or Plus's #4-5) — MatchAvatarRing's own
  // `locked` prop bakes a real blur into the photo itself (UserAvatar's
  // `blurRadius`), not a translucent overlay; this component just adds the
  // small lock badge on top of it. The percentage text below the ring is
  // untouched either way — still the actual "tease." Still calls onSelect
  // on tap (this component doesn't know about tiers or the subscription
  // page) — MatchResultsCloud's own handler is what routes a locked tap
  // differently.
  locked?: boolean;
}

// One cloud bubble: MatchAvatarRing's gray %-ring + avatar + percentage
// text, plus a gentle idle drift. Tapping reveals MatchAnalysisPanel below
// the cloud (MatchResultsCloud owns the actual selection state) — a smooth
// grow transform marks the selection now, see SELECT_SCALE_MS above for why
// this replaced an earlier border-highlight treatment.
//
// Wrapped in React.memo: MatchResultsCloud re-renders all ≤5 bubbles on
// every selection change (a Pressable tap flips its own `selectedId`
// state), but only the bubble(s) whose own `isSelected` value actually
// changes need to re-render — every other prop here (candidate, x/y/
// diameter/rank from a stable useMemo'd layout, bobAnim/lineBobAnim from a
// stable ref cache, onSelect from a stable useCallback) is already
// reference-stable across those re-renders, so memo's shallow comparison
// correctly skips the untouched bubbles instead of needing a custom
// comparator.
function MatchCloudBubble({ candidate, x, y, diameter, rank, bobAnim, lineBobAnim, onSelect, isSelected, selectedScale, locked }: Props) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: "absolute", alignItems: "center" },
        lockBadge: {
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base100,
          borderRadius: 999,
          padding: 6,
        },
      }),
    [colors]
  );
  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isSelected ? selectedScale : 1,
      duration: SELECT_SCALE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectedScale, scaleAnim]);

  useEffect(() => {
    let cancelled = false;
    const runLoop = () => {
      if (cancelled) return;
      Animated.timing(bobAnim, {
        toValue: { x: rand(-BOB_AMPLITUDE, BOB_AMPLITUDE), y: rand(-BOB_AMPLITUDE, BOB_AMPLITUDE) },
        duration: rand(BOB_MIN_MS, BOB_MAX_MS),
        easing: Easing.inOut(Easing.sin),
        // Native-driven — this is the bubble's own visible movement, it
        // needs to stay smooth. The connecting lines get this same motion
        // via a separate, throttled JS-mirrored value below.
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) runLoop();
      });
    };
    runLoop();
    return () => {
      cancelled = true;
    };
  }, [bobAnim]);

  // Mirrors the native-driven bobAnim onto a plain JS-thread value the
  // connecting lines (a different native component the native driver can't
  // update directly) can read — throttled, since this motion is slow enough
  // that updating far less than every frame is visually identical, at a
  // fraction of the cost.
  useEffect(() => {
    let lastSync = 0;
    const id = bobAnim.addListener((value) => {
      const now = Date.now();
      if (now - lastSync < LINE_SYNC_THROTTLE_MS) return;
      lastSync = now;
      lineBobAnim.setValue(value);
    });
    return () => bobAnim.removeListener(id);
  }, [bobAnim, lineBobAnim]);

  const candidateId = candidate.user._id;
  const handlePress = useCallback(() => onSelect?.(candidateId), [onSelect, candidateId]);

  return (
    <Animated.View style={[styles.wrap, { left: x - diameter / 2, top: y - diameter / 2, width: diameter, zIndex: isSelected ? 10 : 0 }]}>
      <Animated.View style={{ transform: [...bobAnim.getTranslateTransform(), { scale: scaleAnim }] }}>
        <Pressable onPress={handlePress} hitSlop={4}>
          <MatchAvatarRing candidate={candidate} diameter={diameter} rank={rank} locked={locked} />
          {locked && (
            <View style={[styles.lockBadge, { top: diameter / 2 - 14, left: diameter / 2 - 14 }]} pointerEvents="none">
              <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default memo(MatchCloudBubble);
