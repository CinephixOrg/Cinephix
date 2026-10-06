import { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import StackedAvatars from "../StackedAvatars";
import type { FeedUserRef } from "../../types";

const ROTATE_EVERY_MS = 4000;
const FADE_MS = 300;

// StackedAvatars, but when there are more people than fit (max), the
// visible window quietly cross-fades to the next few every few seconds
// instead of just showing the same 5 forever — direct ask ("aralarında
// sürekli yer değiştirsin... fade away bir şekilde"), gated on actually
// having more than `max` people: nothing to rotate through means no
// timer at all, so a small watch party never pays for this.
function RotatingAvatarStack({ users, size = 20, max = 5 }: { users: FeedUserRef[]; size?: number; max?: number }) {
  const [windowStart, setWindowStart] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const needsRotation = users.length > max;

  useEffect(() => {
    if (!needsRotation) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start(() => {
        setWindowStart((start) => (start + max) % users.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
      });
    }, ROTATE_EVERY_MS);
    return () => clearInterval(timer);
    // users.length/max changing mid-rotation is rare enough (a live
    // party's RSVP list barely moves) that restarting the timer isn't
    // worth guarding against.
  }, [needsRotation, users.length, max, opacity]);

  // A window past the end wraps around rather than running short — e.g.
  // 7 users, max 5, windowStart 5 shows users[5], users[6], users[0].
  const visible = needsRotation
    ? Array.from({ length: max }, (_, i) => users[(windowStart + i) % users.length])
    : users;

  return (
    <Animated.View style={needsRotation ? { opacity } : undefined}>
      <StackedAvatars users={visible} size={size} max={max} />
    </Animated.View>
  );
}

export default memo(RotatingAvatarStack);
