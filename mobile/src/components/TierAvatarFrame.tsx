import { View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import { useTheme } from "../context/ThemeContext";
import type { AccountTier } from "../types";

// Thin border, not a filled band — the previous version's ring ate ~9% of
// the avatar's own size and butted straight up against it, which read as
// cluttered. GAP_WIDTH is the "offset" that keeps the ring from touching
// the avatar at all; both are fixed px (not size-proportional) since a
// hairline border should stay a hairline at any avatar size.
const RING_WIDTH = 1.5;
const GAP_WIDTH = 2.5;
const INSET = RING_WIDTH + GAP_WIDTH;

interface Props {
  // Undefined/null (data not loaded, or this context doesn't carry tier
  // data yet) renders the child avatar completely unwrapped — no frame,
  // no footprint change. Never guesses "free" as a default.
  tier?: AccountTier | null;
  // Outer footprint in px — matches whatever size the surrounding layout
  // already expects an avatar to take up, so dropping this in doesn't
  // shift anything around it. The ring+gap are drawn *inside* this size,
  // not added on top of it.
  size: number;
  // The gap ring is a solid fill matching whatever surface this avatar
  // sits on, so it reads as empty space rather than a mismatched patch —
  // defaults to the screen background (correct for the large majority of
  // call sites); pass the card's own color when an avatar sits on a
  // colored card instead (e.g. SuggestedUserCard's base200 tile).
  backgroundColor?: string;
  // Render-prop instead of plain children: the frame eats a few px off
  // the edge for the ring+gap, so the actual avatar image/fallback needs
  // to be built at the resulting inner size, not `size` verbatim.
  children: (innerSize: number) => React.ReactNode;
}

// Modular tier-frame wrapper — the one place that turns an accountTier into
// a subtle ring+glow around any avatar markup. New call sites just need a
// `tier` value and to render their existing Image-or-initials via the
// `children(innerSize)` callback; new tiers/colors only ever need editing
// in tierFrames.ts, never here or at a call site.
export default function TierAvatarFrame({ tier, size, backgroundColor, children }: Props) {
  const { colors } = useTheme();
  const style = tier ? TIER_FRAME_STYLES[tier] : null;
  if (!style) return <>{children(size)}</>;

  const gapSize = size - RING_WIDTH * 2;
  const innerSize = size - INSET * 2;

  return (
    <LinearGradient
      colors={style.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        // A soft colored halo instead of a heavy stroke — iOS/Android both
        // read these directly on the Fabric renderer this app runs on, no
        // elevation workaround needed for the color to show.
        shadowColor: style.glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: Platform.OS === "android" ? 3 : 0,
      }}
    >
      <View
        style={{
          width: gapSize,
          height: gapSize,
          borderRadius: gapSize / 2,
          backgroundColor: backgroundColor ?? colors.base100,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, overflow: "hidden" }}>
          {children(innerSize)}
        </View>
      </View>
    </LinearGradient>
  );
}
