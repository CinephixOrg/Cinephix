import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Gradient-filled icon — MaskedView clips a LinearGradient to the icon
// glyph's own alpha shape. An earlier version tried painting the glyph
// directly via react-native-svg's Text (the same fill="url(#...)"
// technique TierGradientText.tsx/MatchGradientTitle.tsx use for gradient
// TEXT), reusing Ionicons' own font + codepoint — broke on-device (a
// completely different, wrong character rendered instead of the icon),
// because SVG's own font resolution doesn't reliably find a custom icon
// font registered through @expo/vector-icons' own loading path, unlike a
// regular text font loaded via expo-font's standard useFonts hook.
// MaskedView sidesteps that entirely: the mask is a perfectly normal
// <Ionicons> glyph, rendered through its own already-proven-correct path
// everywhere else in this app — only the gradient fill behind it is new.
// Already a transitive dependency via expo-router (which uses it for its
// own native-stack transitions) and Expo-Go-compatible, so no new native
// linking risk.
interface Props {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  colors: [string, string];
}

export default function GradientIcon({ name, size, colors }: Props) {
  return (
    <MaskedView style={{ width: size, height: size }} maskElement={<Ionicons name={name} size={size} color="#000000" />}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
    </MaskedView>
  );
}
