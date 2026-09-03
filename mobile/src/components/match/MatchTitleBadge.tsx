import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  text: string;
  // Same reasoning as MatchGradientTitle's own gradientId prop: every card
  // in this deck stays mounted at once (just scrolled off-screen), so a
  // hardcoded <LinearGradient id> here would collide the moment this
  // component is ever used more than once in the same tree.
  gradientId: string;
  // Live horizontal scroll offset of the card deck (MatchAnalysisPanel's
  // own Animated.event-driven value), used to fade this out the instant a
  // swipe away from the ai-summary card begins — see dragOpacity below.
  scrollX: Animated.Value;
}

const BADGE_WIDTH = 200;
const LINE_HEIGHT = 26;
const FONT_SIZE = 19;
const MAX_LINES = 3;
// How far below the card's top edge the badge's own center sits — direct
// feedback that dead-center-on-the-edge read as a touch too high.
const VERTICAL_NUDGE = 12;
// Entrance "stamp" — starts oversized and rotated further off its resting
// tilt, then spring-snaps down to full size and FINAL_ROTATE_DEG, the same
// slam-into-place read as a rank-up badge in a game's end-of-match screen.
// Deliberately more dramatic than every other reveal in this feature
// (useRevealAnimation's plain fade+slide) — a direct, explicit ask for
// that specific game-y feel on this one element, not the norm elsewhere.
const STAMP_START_SCALE = 2.6;
const STAMP_START_ROTATE_DEG = -34;
const FINAL_ROTATE_DEG = -10;
// How far (in px of horizontal scroll) the deck has to move before this
// badge is fully faded out — small on purpose. This card is always the
// first (index 0) in the deck, so any positive scrollX at all means the
// user has started swiping away from it; a short distance here is what
// makes the fade read as "gone as soon as you start dragging" rather than
// "gone once the next card has already snapped into place."
const DRAG_FADE_DISTANCE = 40;

// Line count is driven by word count, not a fixed words-per-line cap — a
// direct spec: 1-2 words stays one line, 3-4 words becomes two, 5+ becomes
// three. wordsPerLine is then derived (tokens / target lines, rounded up)
// so the words actually spread evenly across that many lines instead of
// packing the first lines full and leaving a short last one.
function targetLineCount(wordCount: number): number {
  if (wordCount <= 2) return 1;
  if (wordCount <= 4) return 2;
  return 3;
}

// A hyphenated compound ("Wide-Angle") stays a single unbreakable token for
// LAYOUT purposes (see wrapMatchTitle below — never split mid-compound),
// but direct feedback was that it still needs to COUNT as two words when
// deciding the target line count: "Wide-Angle Explorers" is 2 space-
// separated tokens but reads as 3 real words, and was wrapping to one line
// when it should wrap to two ("Wide-Angle" / "Explorers"). This counts
// each hyphen/dash-joined part of a token separately without touching how
// tokens themselves get grouped into lines.
function conceptualWordCount(tokens: string[]): number {
  return tokens.reduce((sum, token) => sum + token.split(/[-–—]+/).filter(Boolean).length, 0);
}

// react-native-svg's Text doesn't auto-wrap, so the LLM's match_title has
// to be pre-split into lines before it ever reaches SvgText. A trailing
// comma/dash on a word is treated as a natural break (ends the line early
// even under the per-line word cap) so multi-clause titles ("Genre
// Explorers, Taste Twins") break at the clause boundary instead of
// mid-phrase — a hyphen *inside* a word ("Slow-Burn") doesn't match since
// the check only looks at the end of each word, so compound words stay
// intact. Any overflow past MAX_LINES (only possible from an unusually
// long or comma-heavy title) gets folded into the last line rather than
// dropped — content is never truncated, just less evenly distributed in
// that edge case.
function wrapMatchTitle(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const targetLines = targetLineCount(conceptualWordCount(words));
  const wordsPerLine = Math.ceil(words.length / targetLines);

  const lines: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const endsAtNaturalBreak = /[,\-–—]$/.test(word);
    if (current.length >= wordsPerLine || (endsAtNaturalBreak && lines.length < targetLines - 1)) {
      lines.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) lines.push(current.join(" "));

  if (lines.length > MAX_LINES) {
    const head = lines.slice(0, MAX_LINES - 1);
    const tail = lines.slice(MAX_LINES - 1).join(" ");
    return [...head, tail];
  }
  return lines;
}

// The LLM's match_title, as a small tilted sticker straddling the Sync
// Summary card's own top edge — same bare-shape, gradient-fill-on-glyph
// language as ShareCard's heart/plus stickers (no pill/background, no
// border), just applied to (possibly multi-line) text instead of an icon
// glyph. Centered on the card's top edge (its own box center lands exactly
// on the horizontal midpoint of that edge, at y:0) rather than pinned to a
// corner — a direct correction from an earlier top-left-corner placement.
//
// Rendered by MatchAnalysisPanel.tsx OUTSIDE the horizontal card-paging
// ScrollView entirely — not as a per-card child, even though it's only
// ever shown for the "ai-summary" card. That ScrollView's own viewport
// clips to cardHeight (its cross-axis size is driven by the tallest
// card), and since this badge is centered exactly on y:0, roughly half of
// it necessarily renders *above* that boundary — inside the ScrollView,
// that half was silently clipped away (read as "stuck behind the page").
// The unclipped sibling View this now renders into shares the exact same
// width as a card (via the same HORIZONTAL_PADDING math) and its own y:0
// lines up with every card's own y:0, and a paging ScrollView always
// presents its active card starting right at the viewport's own left
// edge — so positioning this at that sibling's own left:0 tracks
// whichever card is active without needing to read live scroll position.
//
// Uses the extrabold DM Sans weight (loaded app-wide in app/_layout.tsx)
// rather than the bold weight every other gradient-text element in this
// feature uses (see MatchGradientTitle) — a deliberate one-off, since
// this is the single most eye-catching element on the card and reads
// better noticeably heavier than everything around it.
export default function MatchTitleBadge({ text, gradientId, scrollX }: Props) {
  const { colors } = useTheme();
  const lines = useMemo(() => wrapMatchTitle(text), [text]);
  const svgHeight = lines.length * LINE_HEIGHT + 6;

  // Keyed on `text` itself (not just mount) so the stamp replays on every
  // real candidate switch — MatchAnalysisPanel isn't remounted per
  // candidate (no `key` on it), so this component's own props just update
  // in place rather than remounting, the same reason every other reset-on-
  // switch effect in this feature is keyed on changing content/ids rather
  // than relying on mount timing.
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      friction: 4,
      tension: 45,
      useNativeDriver: true,
    }).start();
  }, [text, entrance]);

  const stampScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [STAMP_START_SCALE, 1] });
  const stampRotate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [`${STAMP_START_ROTATE_DEG}deg`, `${FINAL_ROTATE_DEG}deg`],
  });
  // Fades in over just the first slice of the spring — starting fully
  // opaque at 2.6x scale looked like a jump-cut, not a slam; a quick fade
  // underneath the scale/rotate motion reads as one continuous entrance.
  const stampOpacity = entrance.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: "clamp" });
  // ai-summary is always the deck's first card (index 0), so any positive
  // scrollX at all means the user has started dragging away from it —
  // this fades out over the drag itself rather than waiting for
  // MatchAnalysisPanel's activeIndex, which only updates once the swipe
  // fully settles (onMomentumScrollEnd), well after the drag has begun.
  const dragOpacity = scrollX.interpolate({ inputRange: [0, DRAG_FADE_DISTANCE], outputRange: [1, 0], extrapolate: "clamp" });
  const opacity = Animated.multiply(stampOpacity, dragOpacity);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // left:"50%" + a negative marginLeft of half the badge's own width
        // is the standard RN/CSS trick for centering an absolutely
        // positioned element without needing to know the parent's width —
        // works here since the card's own width varies by device.
        sticker: { position: "absolute", left: "50%", marginLeft: -BADGE_WIDTH / 2, zIndex: 5 },
      }),
    []
  );

  if (lines.length === 0) return null;

  return (
    // top:VERTICAL_NUDGE + a negative marginTop of half the (line-count-
    // dependent) badge height centers it vertically VERTICAL_NUDGE px
    // below the card's own top edge (y:0), instead of exactly on it — a
    // direct "move it down a bit, only vertically" correction — while
    // still keeping that center point locked to y:0's offset regardless
    // of whether the title wrapped to 1, 2, or 3 lines. Horizontal
    // centering (left:"50%"/marginLeft, in `sticker` above) is untouched.
    // Rotation is the animated `stampRotate` value (settles on the same
    // -10deg as before), not a fixed transform — see the stamp-entrance
    // comment on `entrance` above.
    <Animated.View
      style={[
        styles.sticker,
        {
          top: VERTICAL_NUDGE,
          marginTop: -svgHeight / 2,
          opacity,
          transform: [{ rotate: stampRotate }, { scale: stampScale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* overflow="visible" is the actual fix for clipped edges — SVG
          viewports clip to their own width/height by default, and a wide
          line (long words, or the extrabold face itself running wider
          than `bold`) can render past BADGE_WIDTH even after sizing it
          generously. Text stays centered on the canvas either way (x:50%
          + textAnchor:middle), it's just no longer hard-cropped left/right
          when it doesn't fit. */}
      <Svg width={BADGE_WIDTH} height={svgHeight} style={{ overflow: "visible" }}>
        <Defs>
          {/* Same technique ShareCard's gold premium-tier border uses for
              its "shiny" read (a bright highlight fading into a saturated
              color, on a diagonal) — applied to the fill, not a stroke or
              an outer glow, and to this badge's own primary/secondary
              pair rather than swapped for gold, so it stays visually
              consistent with the rest of this feature's gradient text.
              Highlight sits at the midpoint (not the leading edge) — each
              line is its own SvgText with its own bounding box, so an
              offset:0 highlight landed squarely on that line's first
              letters instead of reading as a sweep of light across it. */}
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="0.5" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor={colors.secondary} />
          </LinearGradient>
        </Defs>
        {lines.map((line, i) => (
          <SvgText
            key={i}
            x="50%"
            y={(i + 1) * LINE_HEIGHT - 6}
            textAnchor="middle"
            fontFamily={fonts.extrabold}
            fontSize={FONT_SIZE}
            fontWeight="800"
            fill={`url(#${gradientId})`}
          >
            {line}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  );
}
