import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";
import { fonts } from "../theme/typography";
import type { AccountTier } from "../types";

interface Props {
  text: string;
  tier?: AccountTier | null;
  fontSize: number;
  // Every gradient-text element in this app hand-picks its own unique id
  // (see match/MatchGradientTitle.tsx's own doc comment) rather than
  // sharing one — needed here even more than there, since this renders once
  // per card in a scrollable list of many simultaneously-mounted cards, not
  // a handful of fixed feature screens.
  gradientId: string;
  // Plain color used when tier has no gradient entry (free/none) — same
  // tier?.-optional fallback convention TierAvatarFrame itself already uses.
  color: string;
  bold?: boolean;
}

const CANVAS_PADDING = 6;

// Small inline metallic-gradient label — gold for Premium, silver for
// Plus, off the exact same TIER_FRAME_STYLES gradient pair the avatar
// ring itself already uses (so "gold ring + gold name" reads as one
// consistent Premium treatment, not two different golds), applied to the
// glyphs themselves via react-native-svg's Text fill="url(#...)" support —
// the same technique match/MatchGradientTitle.tsx already uses for the
// Sync results' own gradient headline. Built for Popular Lists/Popular
// Reviews' reviewer/owner name, per direct ask that Premium/Plus be shown
// there via the avatar ring + this "painted" name rather than the gold
// card-border treatment ShareCard.tsx's posts use (that one stays post-
// only, not reused here).
//
// react-native-svg's own Text can't auto-size its canvas to its own glyph
// run the way RN's plain Text can — an earlier version of this component
// estimated the canvas width from the label's character count instead,
// which ran a bit wide and, in DiscoverListCard.tsx's own owner row (name
// then avatar), showed up as a real, reported gap between the name and
// whatever sat right after it. Fixed by actually measuring: an invisible
// plain RN Text (real intrinsic sizing) reports its own rendered width via
// onLayout, and the SVG only mounts once that measurement is in — exact
// regardless of font metrics, string content, or a future call site that
// puts something else right after this component in the same row.
export default function TierGradientText({ text, tier, fontSize, gradientId, color, bold }: Props) {
  const gradient = tier ? TIER_FRAME_STYLES[tier]?.gradient : null;
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const fontFamily = bold ? fonts.bold : fonts.medium;

  if (!gradient) {
    return (
      <Text style={{ fontFamily, fontSize, color }} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  const height = fontSize + CANVAS_PADDING;
  const onMeasure = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
  };
  // Plus specifically, direct ask: the bright stop (gradient[0], near-white)
  // centered instead of leading from the left edge — dark->bright->dark reads
  // as a shine sweeping across the middle of the name, closer to an actual
  // brushed-metal highlight than a flat corner-to-corner fade. Premium's own
  // gold stays the original 2-stop version, not asked to change. An array
  // (not a Fragment) — react-native-svg's <LinearGradient> children typing
  // wants ReactElement[], and a Fragment doesn't satisfy that.
  const stops =
    tier === "plus"
      ? [
          <Stop key="0" offset="0" stopColor={gradient[1]} />,
          <Stop key="0.5" offset="0.5" stopColor={gradient[0]} />,
          <Stop key="1" offset="1" stopColor={gradient[1]} />,
        ]
      : [<Stop key="0" offset="0" stopColor={gradient[0]} />, <Stop key="1" offset="1" stopColor={gradient[1]} />];

  return (
    <View>
      {/* Invisible measuring pass — stays mounted (not torn down after the
          first measure) so a text/fontSize prop change re-measures
          automatically instead of freezing at a stale width. Deliberately
          NOT position:"absolute" (an earlier version had it that way) —
          that left the wrapping View at zero width for the first render
          frame (an absolutely-positioned child contributes nothing to its
          parent's own layout size), so anything sitting right after this
          component in a row — e.g. ShareCard.tsx's tierMark diamond —
          visibly popped/shifted into place the moment the real SVG below
          finally mounted and gave the View its true width. Keeping this
          Text in normal flow reserves the correct width from frame one
          (same font/size/text as what's being measured, so its layout box
          IS the right size already); the SVG is the one absolutely
          positioned now, drawn on top of this reserved space once ready. */}
      <Text style={{ fontFamily, fontSize, opacity: 0 }} numberOfLines={1} onLayout={onMeasure}>
        {text}
      </Text>
      {measuredWidth != null && (
        <Svg width={measuredWidth} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {stops}
            </LinearGradient>
          </Defs>
          <SvgText
            x="0"
            y={height - CANVAS_PADDING}
            textAnchor="start"
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontWeight={bold ? "bold" : "500"}
            fill={`url(#${gradientId})`}
          >
            {text}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}
