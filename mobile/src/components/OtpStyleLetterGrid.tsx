import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Animated, Easing, useWindowDimensions } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { DailyGameBox } from "../types";

const BOX_GAP = 6;
const WORD_GAP = 10;
const SCREEN_PADDING = 40; // matches app/daily-game.tsx's own content padding (20 each side)
// Direct report: a notch smaller than before (was 26-44).
const MIN_BOX = 22;
const MAX_BOX = 38;

interface Props {
  shape: DailyGameBox[][];
  value: string; // the player's own typed letters for editable positions only, in order — owned by the parent
  onChangeValue: (value: string) => void;
  disabled?: boolean;
}

// Reassembles the full title guess (revealed letters + the player's own
// typed ones, in true box order) from the parent's own `value` — exported
// so the screen that owns `value` can derive what to actually submit
// without duplicating this box/editable-position bookkeeping itself.
export function buildFullGuess(shape: DailyGameBox[][], value: string): string {
  let pos = 0;
  return shape
    .flat()
    .map((b) => {
      if (b.letter !== null) return b.letter;
      const ch = value[pos] ?? "";
      pos += 1;
      return ch;
    })
    .join("");
}

export function isGuessComplete(shape: DailyGameBox[][], value: string): boolean {
  const editableCount = shape.flat().filter((b) => b.letter === null).length;
  return value.length >= editableCount;
}

// Rebuilt from scratch after repeated custom cursor/focus-juggling
// attempts (per-box TextInputs with manual focus-chasing, then a single
// hidden input with a hand-rolled cursor ref and character redistribution)
// each turned out to have their own native-timing edge case under fast
// typing. The actual typing experience is still a single, completely
// standard, fully-controlled TextInput — no custom focus calls, no
// per-keystroke redistribution — just `value`/`onChangeText`/`maxLength`,
// the most basic and most battle-tested code path React Native has.
// Backspace is the platform's own default "remove the last character"
// behavior, not custom logic.
//
// Tapping an earlier box to fix it (direct ask, restored after an initial
// cut for reliability) does NOT use TextInput's own `selection` prop —
// tried first, confirmed unreliable (a controlled `selection` update
// doesn't reliably move Android's native cursor on demand, a known
// platform limitation, not a bug in this component). Instead: tapping a
// box just remembers which position should receive the NEXT keystroke
// (`pendingEditPos`). The hidden input keeps behaving completely
// normally — the user's next character still lands wherever the native
// cursor already is (almost always the end, since nothing told it to
// move) — but `handleChangeText` notices the pending target and SPLICES
// that new character into `pendingEditPos` instead of leaving it
// appended, then forces the TextInput's controlled `value` back down to
// that corrected string. This only ever leans on the one mechanism this
// component has already proven reliable (controlled `value`), never the
// flaky `selection` prop.
export default function OtpStyleLetterGrid({ shape, value, onChangeValue, disabled }: Props) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const inputRef = useRef<TextInput | null>(null);
  const [pendingEditPos, setPendingEditPos] = useState<number | null>(null);
  // Purely cosmetic — which box the blinking cursor bar renders in right
  // after a tap, before the next keystroke lands (which then clears this
  // and falls back to the normal end-of-string position below).
  const [tappedPos, setTappedPos] = useState<number | null>(null);

  const flatBoxes = useMemo(() => shape.flat(), [shape]);
  const editableCount = useMemo(() => flatBoxes.filter((b) => b.letter === null).length, [flatBoxes]);

  const boxSize = useMemo(() => {
    const longestWord = Math.max(1, ...shape.map((w) => w.length));
    const available = screenWidth - SCREEN_PADDING;
    const fitted = (available - (longestWord - 1) * BOX_GAP) / longestWord;
    return Math.max(MIN_BOX, Math.min(MAX_BOX, Math.floor(fitted)));
  }, [shape, screenWidth]);
  const boxHeight = boxSize + 8;
  const fontSize = Math.round(boxSize * 0.46);

  // Which typed-array slot each editable box maps to, in reading order —
  // computed once per shape, not per keystroke.
  const editablePositionByBoxIndex = useMemo(() => {
    const map = new Map<number, number>();
    let pos = 0;
    for (const b of flatBoxes) {
      if (b.letter === null) {
        map.set(b.index, pos);
        pos += 1;
      }
    }
    return map;
  }, [flatBoxes]);

  const activePos = tappedPos ?? (value.length < editableCount ? value.length : editableCount - 1);

  const handleBoxPress = (pos: number) => {
    if (disabled) return;
    const clamped = Math.min(pos, value.length);
    setPendingEditPos(clamped);
    setTappedPos(clamped);
    inputRef.current?.focus();
  };

  // See this file's own top-of-component comment for why this splices
  // rather than relying on the TextInput's own cursor/selection.
  const handleChangeText = (text: string) => {
    let finalValue = text;
    if (pendingEditPos !== null && text.length > value.length) {
      const newChars = text.slice(value.length).split("");
      const chars = value.split("");
      let pos = pendingEditPos;
      for (const ch of newChars) {
        chars[pos] = ch;
        pos += 1;
      }
      finalValue = chars.join("");
    }
    setPendingEditPos(null);
    setTappedPos(null);
    onChangeValue(finalValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, editableCount));
  };

  // A real blinking text-cursor bar in the active empty box, not a
  // recolored box border — direct ask. Same blink-loop technique already
  // used elsewhere in this app for a bobbing hint arrow (Animated.loop +
  // Animated.sequence), just driving opacity instead of position.
  const cursorBlink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, { toValue: 0, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(cursorBlink, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cursorBlink]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Direct ask: each word gets its own row — a column of word-rows,
        // not a flex-wrap flow that could let two short words share one
        // line. `word` keeps its own flexWrap as a safety net for the rare
        // single word longer than the screen can fit (boxSize is sized to
        // the longest word, so in practice it never needs to actually
        // wrap), with WORD_GAP now the vertical gap between word-rows
        // instead of a horizontal one.
        row: { flexDirection: "column", alignItems: "center" },
        word: { flexDirection: "row", flexWrap: "wrap", gap: BOX_GAP, marginBottom: WORD_GAP, justifyContent: "center" },
        box: {
          width: boxSize,
          height: boxHeight,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        boxRevealed: { backgroundColor: colors.primary + "22", borderColor: colors.primary },
        // Direct report: revealed (hint-filled) letters read as too small.
        // Same font family/weight, just a bit larger than a normally-
        // typed letter — also makes a hint-revealed box visually distinct
        // at a glance, not just by its background tint.
        boxSelected: { backgroundColor: colors.primary + "22" },
        boxText: { fontFamily: fonts.bold, fontSize, color: colors.baseContent },
        boxTextRevealed: { color: colors.primary, fontSize: Math.round(fontSize * 1.15) },
        cursorBar: { position: "absolute", width: 2, height: boxHeight * 0.55, borderRadius: 1, backgroundColor: colors.primary },
        hiddenInput: { position: "absolute", top: 0, left: 0, opacity: 0, width: 1, height: 1 },
      }),
    [colors, boxSize, boxHeight, fontSize]
  );

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChangeText}
        // +1, not editableCount — when the grid is already full and the
        // player taps an earlier box to fix it, the native cursor (never
        // moved — see this file's own top comment) still appends at the
        // very end; without this one character of headroom the native
        // side would reject that keystroke outright as "already at max
        // length" before handleChangeText ever got a chance to splice it
        // into the right position. handleChangeText always trims the
        // final value back down to the true length regardless.
        maxLength={editableCount + 1}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!disabled}
        pointerEvents="none"
      />
      {shape.map((word, wi) => (
        <View key={wi} style={styles.word}>
          {word.map((box) => {
            const revealed = box.letter !== null;
            const pos = editablePositionByBoxIndex.get(box.index);
            const letter = revealed ? box.letter : pos !== undefined ? value[pos] ?? "" : "";
            const isActive = !revealed && !disabled && pos === activePos;
            const content = (
              <View style={[styles.box, revealed && styles.boxRevealed, isActive && !!letter && styles.boxSelected]}>
                <Text style={[styles.boxText, revealed && styles.boxTextRevealed]}>{letter}</Text>
                {isActive && !letter && <Animated.View style={[styles.cursorBar, { opacity: cursorBlink }]} />}
              </View>
            );
            // Only editable boxes are individually tappable (to
            // reposition editing there) — revealed/locked ones never are.
            return revealed || pos === undefined ? (
              <View key={box.index}>{content}</View>
            ) : (
              <Pressable key={box.index} onPress={() => handleBoxPress(pos)}>
                {content}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Pressable>
  );
}
