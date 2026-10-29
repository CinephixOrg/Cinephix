import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getPuzzleStreak, getLeaderboard } from "../../api/dailyGameService";
import UserAvatar from "../UserAvatar";
import GradientIcon from "../GradientIcon";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { DailyGameLeaderboardEntry } from "../../types";

const ICON_SIZE = 20;
const ROTATE_MS = 2800;
const FADE_MS = 400;
const TICKER_POLL_MS = 60_000;

// The left-hand side of the band: a gradient-filled icon + a short label,
// cross-fading between two states once there's a real streak to show —
// direct ask, same cross-fade-batches technique as the ticker below
// (Animated.Value opacity, setInterval, fade-out/swap/fade-in). With no
// streak yet there's nothing to alternate with, so it just sits on the
// CTA state permanently.
function DailyGameLeftFade({ streak }: { streak: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showStreak, setShowStreak] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak <= 0) {
      setShowStreak(false);
      return;
    }
    const rotate = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setShowStreak((s) => !s);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [streak, opacity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
        text: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, flexShrink: 1 },
      }),
    [colors]
  );

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <GradientIcon name={showStreak ? "flame" : "extension-puzzle"} size={ICON_SIZE} colors={[colors.primary, colors.secondary]} />
      <Text style={styles.text} numberOfLines={1}>
        {showStreak ? t("{{count}} day streak", { count: streak }) : t("Solve today's puzzle!")}
      </Text>
    </Animated.View>
  );
}

// The right-hand side: a live "who's winning" ticker, same cross-fade-
// batches technique FadingMemberAvatars.tsx already established. No
// username shown — just rank + avatar + score, so the row stays compact.
// Polls GET /daily-game/leaderboard every 60s while mounted, not just
// once, so it keeps feeling "live" during a longer Shares-browsing
// session.
function DailyGameTicker() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DailyGameLeaderboardEntry[]>([]);
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const load = () => getLeaderboard().then((res) => setEntries(res.entries)).catch(() => {});
    load();
    const poll = setInterval(load, TICKER_POLL_MS);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    setIndex(0);
    if (entries.length <= 1) return;
    const rotate = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % entries.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [entries, opacity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 6 },
        rank: { fontFamily: fonts.bold, fontSize: 11, color: colors.warning, width: 14 },
        score: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
      }),
    [colors]
  );

  if (entries.length === 0) return null;
  const entry = entries[index];

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <Text style={styles.rank}>#{index + 1}</Text>
      <UserAvatar userId={entry.user.id} username={entry.user.username} profilePicUrl={entry.user.profile_pic_url} size={18} disabled />
      <Text style={styles.score}>{t("{{score}} pts", { score: entry.score })}</Text>
    </Animated.View>
  );
}

// TC-136's daily guessing game — the entry point, deliberately the very
// top of Shares (above OnlineFriendsBar, not a small corner badge): the
// whole point of this feature is daily-return engagement, so it needs the
// highest-visibility spot on the page, not a hideable icon. Self-fetches
// like OnlineFriendsBar/LeaderboardPodium.
//
// Slimmed into a single full-bleed band, direct ask ("bant ekrana tam
// koy... daha ince yap") — same edge-to-edge, bottom-hairline-border strip
// convention OnlineFriendsBar already uses, sitting flush under the
// header with no gap (see SharesFeedSection.tsx's own dailyGameInset/list
// style comments). The old "Play"/score pill is gone; a plain trailing
// chevron is the only static affordance now, and the gradient fill
// (primary → secondary, theme tokens) stays as a low-alpha wash across
// the whole band rather than a boxed badge, keeping the "dynamic/lively"
// read the user explicitly wants to preserve even at this smaller size.
export default function DailyGameCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const [streak, setStreak] = useState(0);

  // getPuzzleStreak, not getTodayPuzzle — direct report: this band sits at
  // the top of Shares and mounts (and thus fetched) well before the player
  // ever taps into the real game, but getTodayPuzzle's own GET /today call
  // silently creates today's attempt (and starts its real elapsed-time
  // clock) as a side effect. Reading just the streak here keeps that side
  // effect scoped to the moment the player actually opens the game.
  useEffect(() => {
    getPuzzleStreak()
      .then(({ puzzleStreak }) => setStreak(puzzleStreak))
      .catch(() => {});
  }, []);

  const styles = StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    spacer: { flex: 1 },
  });

  return (
    <Pressable onPress={() => router.push("/daily-game" as any)}>
      <LinearGradient
        colors={[colors.primary + "22", colors.secondary + "22"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.row}
      >
        <DailyGameLeftFade streak={streak} />
        <View style={styles.spacer} />
        <DailyGameTicker />
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
      </LinearGradient>
    </Pressable>
  );
}
