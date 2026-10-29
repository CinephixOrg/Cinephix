import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, Text, Image, ActivityIndicator, ScrollView, Animated, StyleSheet } from "react-native";
// Not react-native's own Modal — this app's own house rule (a plain Modal
// has no gesture root, so nothing inside it responds to gesture-handler's
// touch system), same convention every other modal in this codebase follows.
import Modal from "../src/components/common/GestureModal";
import Pressable from "../src/components/common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { getTodayPuzzle, useHint, submitGuess, getLeaderboard } from "../src/api/dailyGameService";
import { useBadgeEarned } from "../src/context/BadgeEarnedContext";
import OtpStyleLetterGrid, { buildFullGuess, isGuessComplete } from "../src/components/OtpStyleLetterGrid";
import UserAvatar from "../src/components/UserAvatar";
import { useTheme } from "../src/context/ThemeContext";
import { fonts } from "../src/theme/typography";
import type { DailyGameState, DailyGameGuessResult, DailyGameLeaderboardEntry } from "../src/types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const MAX_BLUR_RADIUS = 30;
const BLUR_HINT_COST = 10;
const LETTER_HINT_COST = 15;
const WRONG_GUESS_COST = 5;
const SCORE_START = 100;
const SCORE_FLOOR_ON_SOLVE = 10;
// Icons shared between the hint buttons and the "How to play" box below —
// one fixed symbol per hint type, direct ask ("iki hinte de bi sembol
// belirlememiz lazım"), with no text label on the buttons themselves.
// "scan-outline" (a focus/frame glyph) for clearing the poster, "key-
// outline" (unlocking one letter) for revealing a letter — chosen to read
// clearly at a glance and to not repeat any icon already used elsewhere
// on this screen (the streak flame, etc.).
const BLUR_HINT_ICON = "scan-outline" as const;
const LETTER_HINT_ICON = "key-outline" as const;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// TC-136's daily guessing game — registered as a modal in app/_layout.tsx
// (mirroring the existing "notifications" screen's registration). Poster
// blur is purely a client-side `blurRadius` render (this app's existing
// house style, e.g. LeaderboardCard.tsx's tier-locked posters) scaled by
// the server's own `blurLevel`/`maxBlurLevel` — the server never
// withholds the image URL itself, only the title/letters.
export default function DailyGameScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { reportEarnedBadges } = useBadgeEarned();
  // The always-visible "How to play" box became a round "?" header button
  // + a centered popup — direct ask. Opening it pauses the local timer
  // display; closing resumes it from the same value rather than jumping to
  // reflect the real time that passed while reading (pausedMsRef tracks
  // total paused time so far, subtracted from every tick's elapsed calc).
  const [infoVisible, setInfoVisible] = useState(false);
  const pausedMsRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const openInfo = () => {
    pauseStartRef.current = Date.now();
    setInfoVisible(true);
  };
  const closeInfo = () => {
    if (pauseStartRef.current !== null) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setInfoVisible(false);
  };

  const [state, setState] = useState<DailyGameState | null>(null);
  const [loading, setLoading] = useState(true);
  // Only ever true while an actual guess submission is in flight — hints
  // no longer touch this, direct ask ("hinte basınca... anında etkisini
  // göstermeli", "guess butonu ve harf kutucukları reload oluyor" — that
  // "reload" look was this same flag disabling/re-enabling the grid and
  // submit button around every hint call too, not just real submits).
  const [submitting, setSubmitting] = useState(false);
  // Which hint (if either) has a request in flight — scoped to just that
  // one button's own spinner, never the rest of the screen.
  const [hintPending, setHintPending] = useState<"blur" | "letter" | null>(null);
  // The player's own typed letters for editable boxes only, in order —
  // OtpStyleLetterGrid.tsx is now a plain controlled input over this one
  // string, nothing more; this screen derives the full guess to submit.
  const [editableGuess, setEditableGuess] = useState("");
  const [result, setResult] = useState<DailyGameGuessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyGameLeaderboardEntry[]>([]);
  // Purely a display value — ticks once a second against the server's own
  // `startedAt` instant. The real time-based score penalty is always
  // computed server-side (dailyGameController.js's submitGuess), never
  // trusted from this local clock.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    getTodayPuzzle()
      .then(setState)
      .catch(() => setError(t("Something went wrong. Please try again.")))
      .finally(() => setLoading(false));
    getLeaderboard()
      .then((res) => setLeaderboard(res.entries))
      .catch(() => {});
  }, [t]);

  const current = result ?? state;

  useEffect(() => {
    if (!current || current.solved || infoVisible) return;
    const startedAtMs = new Date(current.startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAtMs - pausedMsRef.current) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [current?.startedAt, current?.solved, infoVisible]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openInfo} hitSlop={8} accessibilityLabel={t("How to play")} style={{ padding: 4 }}>
          <Ionicons name="help-circle-outline" size={26} color={colors.baseContent} />
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, colors.baseContent, t]);

  // Refreshes the leaderboard once a guess actually lands (right or wrong
  // doesn't matter for a correct one newly joining today's ranking — a
  // wrong guess never changes anyone's rank, but refetching anyway is
  // cheap and keeps this simple rather than special-casing "only on
  // correct").
  useEffect(() => {
    if (!result) return;
    getLeaderboard()
      .then((res) => setLeaderboard(res.entries))
      .catch(() => {});
  }, [result]);

  const applyHint = async (type: "blur" | "letter") => {
    if (hintPending || !current || current.solved) return;
    setError(null);
    // Optimistic for the blur hint — its effect is a pure client-side
    // decrement we already know, no need to wait on the network to show
    // it. The letter hint can't be shown optimistically (the server picks
    // which letter, and deliberately never tells the client the real
    // title to pick one locally) — that one still waits for the real
    // response, but only its own button shows a spinner meanwhile.
    if (type === "blur" && current.blurLevel > 0) {
      setState({ ...current, blurLevel: current.blurLevel - 1, hintsUsed: current.hintsUsed + 1, score: Math.max(0, current.score - BLUR_HINT_COST) });
    }
    setHintPending(type);
    try {
      const next = await useHint(type);
      setState(next); // reconciles with the server's authoritative numbers either way
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Something went wrong. Please try again."));
      if (type === "blur") setState(current); // undo the optimistic step on failure
    } finally {
      setHintPending(null);
    }
  };

  const guessComplete = current ? isGuessComplete(current.shape, editableGuess) : false;

  // A real celebration pop-in for the solved state — direct report: the
  // old "Come back tomorrow" line reused the same red error style as a
  // wrong guess, reading like a failure rather than a win. Springs in once
  // when `current.solved` actually flips true (not on every render of an
  // already-solved puzzle reopened later).
  const correctScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!current?.solved) return;
    correctScale.setValue(0);
    Animated.spring(correctScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [current?.solved, correctScale]);

  const handleSubmit = async () => {
    if (submitting || !guessComplete || !current || current.solved) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitGuess(buildFullGuess(current.shape, editableGuess));
      setResult(res);
      if (res.correct) reportEarnedBadges(res.newlyEarnedBadges);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.base100 },
    content: { padding: 20, alignItems: "center", gap: 20 },
    posterWrap: { width: 160, height: 240, borderRadius: 12, backgroundColor: colors.base300, overflow: "hidden" },
    poster: { width: "100%", height: "100%" },
    streakRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    streakText: { fontFamily: fonts.bold, fontSize: 14, color: colors.warning },
    scoreText: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    timerPill: { flexDirection: "row", alignItems: "center", gap: 4 },
    timerText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
    hintsRow: { flexDirection: "row", gap: 18 },
    // Icon-only, direct ask. Shrunk a notch (was 48/24) to stay
    // proportional with the letter grid's own smaller boxes.
    hintButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      // Direct report: the count badge's own circle looked clipped at its
      // edges — this rounded-corner button was clipping it, since the
      // badge deliberately sits partly outside this button's own bounds
      // (see hintBadge's negative top/right below). `overflow:"visible"`
      // is the explicit opt-out of that clipping.
      overflow: "visible",
    },
    hintButtonDisabled: { opacity: 0.4 },
    hintBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    hintBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primaryContent },
    // Shrunk a notch (was paddingVertical 14/paddingHorizontal 32/fontSize 16).
    submitButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center" },
    submitButtonDisabled: { opacity: 0.5 },
    submitText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
    error: { color: colors.error, textAlign: "center" },
    // Direct report: a real celebration instead of a bare title — a
    // green "Correct!" pill (checkmark + bold text, success-tinted
    // background) that springs in once, sitting above the revealed title.
    correctBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.success + "22",
    },
    correctBadgeText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.success, letterSpacing: 0.3 },
    resultTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.baseContent, textAlign: "center" },
    resultScore: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary, textAlign: "center" },
    // Direct report: this used to reuse the red "wrongText" error style
    // for a SUCCESS message ("Come back tomorrow"), reading like a
    // failure. Neutral placeholder color now — wrongText itself stays
    // red, still correctly used only for the real wrong-guess message.
    comeBackText: { color: colors.placeholder, fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
    wrongText: { color: colors.error, fontFamily: fonts.medium, fontSize: 13 },
    rulesBox: {
      width: "100%",
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    rulesTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, marginBottom: 2 },
    rulesRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    rulesIcon: { width: 20, alignItems: "center", marginTop: 1 },
    rulesText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.placeholder },
    // Centered "Leaderboard" heading — direct ask (the box used to open
    // straight on "Today's Top Scores", left-aligned, with no literal
    // "Leaderboard" label anywhere).
    leaderboardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, textAlign: "center", marginBottom: 4 },
    leaderboardRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    leaderboardRank: { width: 18, fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, textAlign: "center" },
    leaderboardName: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.baseContent },
    leaderboardScore: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
    infoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 24 },
    infoCard: {
      backgroundColor: colors.base100,
      borderRadius: 16,
      padding: 18,
      gap: 10,
    },
    infoHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    infoCloseButton: { padding: 2 },
  });

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 20 }]}>
        <Text style={styles.error}>{error || t("No puzzle available today")}</Text>
      </View>
    );
  }

  const blurRadius = current.maxBlurLevel > 0 ? Math.round((current.blurLevel / current.maxBlurLevel) * MAX_BLUR_RADIUS) : 0;
  const letterHintsLeft = current.maxLetterReveals - current.revealedCount;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.posterWrap}>
        {current.posterPath ? (
          <Image source={{ uri: `${POSTER_BASE}${current.posterPath}` }} style={styles.poster} blurRadius={current.solved ? 0 : blurRadius} />
        ) : null}
      </View>

      {current.puzzleStreak > 0 && (
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={16} color={colors.warning} />
          <Text style={styles.streakText}>{t("{{count}} day streak", { count: current.puzzleStreak })}</Text>
        </View>
      )}

      {current.solved ? (
        <>
          <Animated.View style={[styles.correctBadge, { transform: [{ scale: correctScale }], opacity: correctScale }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.correctBadgeText}>{t("Correct!")}</Text>
          </Animated.View>
          <Text style={styles.resultTitle}>{result?.title ?? t("Solved!")}</Text>
          <Text style={styles.resultScore}>{t("Score: {{score}}", { score: current.score })}</Text>
          <Text style={styles.comeBackText}>{t("Come back tomorrow for a new puzzle!")}</Text>
        </>
      ) : (
        <>
          <OtpStyleLetterGrid shape={current.shape} value={editableGuess} onChangeValue={setEditableGuess} disabled={submitting} />

          {result && !result.correct && <Text style={styles.wrongText}>{t("Not quite — try again.")}</Text>}

          <View style={styles.hintsRow}>
            <Pressable
              style={styles.hintButton}
              onPress={() => applyHint("blur")}
              disabled={hintPending !== null || current.blurLevel <= 0}
              accessibilityLabel={t("Clear poster")}
            >
              {/* The dimmed/disabled look only ever applies to this inner
                  wrapper, never to `hintButton` itself — direct report:
                  opacity on the OUTER view (which also holds the badge
                  below as a child) was clipping the badge's own circular
                  edges once dimmed. React Native forces an offscreen
                  compositing layer, sized to the view's own bounds, the
                  moment an ancestor's opacity drops below 1 — anything
                  overflowing past that ancestor's bounds (the badge,
                  deliberately positioned partway outside this button)
                  gets clipped to that layer regardless of `overflow:
                  "visible"`. Keeping the badge as a sibling OUTSIDE the
                  dimmed wrapper avoids that layer entirely. */}
              <View style={(hintPending !== null || current.blurLevel <= 0) && styles.hintButtonDisabled}>
                {hintPending === "blur" ? (
                  <ActivityIndicator size="small" color={colors.baseContent} />
                ) : (
                  <Ionicons name={BLUR_HINT_ICON} size={22} color={colors.baseContent} />
                )}
              </View>
              {hintPending !== "blur" && (
                <View style={styles.hintBadge}>
                  <Text style={styles.hintBadgeText}>{current.blurLevel}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.hintButton}
              onPress={() => applyHint("letter")}
              disabled={hintPending !== null || letterHintsLeft <= 0}
              accessibilityLabel={t("Reveal letter")}
            >
              <View style={(hintPending !== null || letterHintsLeft <= 0) && styles.hintButtonDisabled}>
                {hintPending === "letter" ? (
                  <ActivityIndicator size="small" color={colors.baseContent} />
                ) : (
                  <Ionicons name={LETTER_HINT_ICON} size={22} color={colors.baseContent} />
                )}
              </View>
              {hintPending !== "letter" && (
                <View style={styles.hintBadge}>
                  <Text style={styles.hintBadgeText}>{letterHintsLeft}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{t("Score: {{score}}", { score: current.score })}</Text>
            <View style={styles.timerPill}>
              <Ionicons name="time-outline" size={13} color={colors.placeholder} />
              <Text style={styles.timerText}>{formatElapsed(elapsedSeconds)}</Text>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.submitButton, (!guessComplete || submitting) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!guessComplete || submitting}>
            {submitting ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.submitText}>{t("Guess")}</Text>}
          </Pressable>
        </>
      )}

      {/* Direct ask — leaderboard now sits right under the game itself
          (used to come after the "How to play" box, last on the page);
          "How to play" moved to the header's own "?" button + popup, so
          this is the very next thing after the puzzle/result. Shown
          regardless of solved state. Same GET /daily-game/leaderboard call
          the Shares-feed ticker (DailyGameCard.tsx) also reads, so both
          surfaces always agree. */}
      {leaderboard.length > 0 && (
        <View style={styles.rulesBox}>
          <Text style={styles.leaderboardTitle}>{t("Leaderboard")}</Text>
          {leaderboard.map((entry, i) => (
            <View key={entry.user.id} style={styles.leaderboardRow}>
              <Text style={styles.leaderboardRank}>{i + 1}</Text>
              <UserAvatar userId={entry.user.id} username={entry.user.username} profilePicUrl={entry.user.profile_pic_url} size={28} disabled />
              <Text style={styles.leaderboardName} numberOfLines={1}>
                {entry.user.username}
              </Text>
              <Text style={styles.leaderboardScore}>{entry.score}</Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={closeInfo}>
        <Pressable style={styles.infoOverlay} onPress={closeInfo}>
          <Pressable style={styles.infoCard} onPress={() => {}}>
            <View style={styles.infoHeaderRow}>
              <Text style={styles.rulesTitle}>{t("How to play")}</Text>
              <Pressable style={styles.infoCloseButton} onPress={closeInfo} hitSlop={8} accessibilityLabel={t("Close")}>
                <Ionicons name="close" size={22} color={colors.baseContent} />
              </Pressable>
            </View>
            <View style={styles.rulesRow}>
              <View style={styles.rulesIcon} />
              <Text style={styles.rulesText}>{t("Guess the movie or series from its blurred poster. Type a letter into any box — it moves to the next one automatically.")}</Text>
            </View>
            <View style={styles.rulesRow}>
              <View style={styles.rulesIcon}>
                <Ionicons name={BLUR_HINT_ICON} size={16} color={colors.baseContent} />
              </View>
              <Text style={styles.rulesText}>{t("Makes the poster a little clearer, −{{cost}} points.", { cost: BLUR_HINT_COST })}</Text>
            </View>
            <View style={styles.rulesRow}>
              <View style={styles.rulesIcon}>
                <Ionicons name={LETTER_HINT_ICON} size={16} color={colors.baseContent} />
              </View>
              <Text style={styles.rulesText}>{t("Reveals one random letter, −{{cost}} points (up to half the title's letters).", { cost: LETTER_HINT_COST })}</Text>
            </View>
            <View style={styles.rulesRow}>
              <View style={styles.rulesIcon} />
              <Text style={styles.rulesText}>{t("A wrong guess costs −{{cost}} points, but you can keep guessing.", { cost: WRONG_GUESS_COST })}</Text>
            </View>
            <View style={styles.rulesRow}>
              <View style={styles.rulesIcon} />
              <Text style={styles.rulesText}>{t("You start at {{start}} points; solving always earns at least {{floor}}.", { start: SCORE_START, floor: SCORE_FLOOR_ON_SOLVE })}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
