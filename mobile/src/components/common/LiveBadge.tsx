import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

// A soft, continuous fade rather than an abrupt on/off blink — direct ask
// ("bir anda yanıp sönme değil, fade away bir şekilde") — so a live watch
// party reads as alive without being jarring. Shared by every "LIVE" badge
// (CommunityHubTab's live hero card, CurrentlyWatchingCard's rail badge)
// so the animation timing only lives in one place.
const FADE_TO = 0.35;
const PHASE_MS = 900;

function LiveBadge({
  label,
  dotStyle,
  textStyle,
  containerStyle,
}: {
  label: string;
  dotStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: FADE_TO, duration: PHASE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PHASE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, containerStyle, { opacity }]}>
      <View style={dotStyle} />
      <Text style={textStyle}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
});

export default memo(LiveBadge);
