import { useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getProfileAnalysis } from "../api/userService";
import { setPendingProfileAnalysis } from "../utils/pendingProfileAnalysis";
import { useToast } from "../context/ToastContext";

// How often the button's own label cycles to the next status line while
// `analyzing` is true — direct ask: a plain spinner read as "stuck/maybe
// broken" during the real network wait (which can run close to Gemini's
// own 15s timeout), so a rotating sequence instead, same idea as a
// long-running upload/export showing "Preparing…" → "Uploading…" →
// "Almost there…". 7 lines * 2000ms covers almost exactly one full 15s
// wait without looping back to the start — each line is also ordered to
// read as real chronological progress (gather → crunch → write →
// assemble), not an arbitrary shuffle, direct ask.
const ANALYZE_STATUS_MS = 2000;
// Cross-fade between lines (fade out, swap text, fade in) — same
// Animated.Value-opacity technique FadingMemberAvatars.tsx/DailyGameCard.tsx
// already use for an identical "rotating line of text" case, direct ask
// for a smoother transition than a hard swap.
const ANALYZE_STATUS_FADE_MS = 350;

// The actual "run my analysis and go look at it" call — extracted out of
// AnalyzeInfoModal.tsx (its own original, only caller) so AnalyzeIntroStory's
// final-slide CTA can trigger the exact same thing directly, rather than
// dismissing into that same info box one more time just to press the real
// button there. Both callers get the identical cooldown/429 handling,
// countdown formatting, and rotating "still working" status text for free.
export function useAnalyzeProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const statusOpacity = useRef(new Animated.Value(1)).current;

  // Ordered to read as real chronological progress, start to finish —
  // direct ask — not an arbitrary shuffle of equally-weighted lines.
  const statusMessages = useMemo(
    () => [
      t("Gathering your data..."),
      t("Analyzing your ratings..."),
      t("Mapping your favorite genres..."),
      t("Studying how your taste has changed..."),
      t("Calculating your stats..."),
      t("Writing your persona..."),
      t("Putting it all together..."),
    ],
    [t]
  );
  // Both callers show this instead of a bare spinner while `analyzing` —
  // see ANALYZE_STATUS_MS's own comment for why.
  const statusMessage = statusMessages[statusIndex];

  useEffect(() => {
    if (!analyzing) {
      setStatusIndex(0);
      statusOpacity.setValue(1);
      return;
    }
    const interval = setInterval(() => {
      Animated.timing(statusOpacity, { toValue: 0, duration: ANALYZE_STATUS_FADE_MS, useNativeDriver: true }).start(() => {
        setStatusIndex((i) => (i + 1) % statusMessages.length);
        Animated.timing(statusOpacity, { toValue: 1, duration: ANALYZE_STATUS_FADE_MS, useNativeDriver: true }).start();
      });
    }, ANALYZE_STATUS_MS);
    return () => clearInterval(interval);
  }, [analyzing, statusMessages.length, statusOpacity]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
      } else {
        forceTick((n) => n + 1);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const formatCooldown = (ms: number) => {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Returns whether it actually succeeded, so a caller that has its own
  // fallback UI (AnalyzeIntroStory falling back to AnalyzeInfoModal) knows
  // whether it still needs to show something.
  const runAnalysis = async (): Promise<boolean> => {
    setAnalyzing(true);
    try {
      const data = await getProfileAnalysis();
      setPendingProfileAnalysis(data);
      router.push("/profile/analyze-story" as any);
      return true;
    } catch (e: any) {
      const retryAfterMs = e?.response?.data?.errors?.retryAfterMs;
      if (e?.response?.status === 429 && retryAfterMs) {
        setCooldownUntil(Date.now() + retryAfterMs);
      } else {
        showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      }
      return false;
    } finally {
      setAnalyzing(false);
    }
  };

  return { analyzing, statusMessage, statusOpacity, cooldownUntil, formatCooldown, runAnalysis };
}
