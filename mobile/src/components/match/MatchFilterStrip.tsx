import { useMemo } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import CineGraphSubTabSwitcher from "../profile/CineGraphSubTabSwitcher";
import CineMatchGenreRing, { MATCH_GENRE_KEYS } from "./CineMatchGenreRing";
import type { CineGraphData, MatchUser } from "../../types";
import type { MatchFilters } from "../../api/matchService";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
  onSubmit: () => void;
  cineGraph: CineGraphData | null;
  // Free tier — the whole card is dimmed + non-interactive, nothing below
  // this can be customized at all.
  locked: boolean;
  // Plus tier — the card itself is usable (type/genre), but the
  // useCount/useAvgRating weighting toggles specifically stay Premium-only;
  // forced true/true server-side (getSyncCandidates) regardless of what a
  // client sends, so this just reflects that visually rather than letting
  // Plus interact with switches that silently wouldn't do anything anyway.
  advancedLocked: boolean;
  viewer: MatchUser;
  // True while the ring's own collapse/spin loading animation is running —
  // disables the ring, the Match button, and hides the disabled-reason note.
  loading?: boolean;
  // Threaded straight through to CineMatchGenreRing's own onSpinComplete —
  // see that component's own prop comment for why match/index.tsx needs
  // this real completion signal instead of a guessed-duration timer.
  onSpinComplete?: () => void;
}

const MATCH_BUTTON_WIDTH = 160;
const MATCH_BUTTON_HEIGHT = 50;

// colors.base300 sat too close to the card's own base200 background to read
// as a track once the thumb slid onto it — a translucent placeholder tint
// stays visibly lighter than the card regardless of the active theme's exact
// base300 value.
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Full rebuild around a copy of Profile's own CineGraphDonut (see
// CineMatchGenreRing.tsx) — matching happens through CineGraph data, so
// picking filter genres by tapping the same visual the user already knows
// from their own profile is more coherent than a generic chip list.
// Replaces the previous round's live-apply/auto-refetch model entirely:
// nothing is selected by default, nothing fetches until "Match" is
// explicitly pressed.
export default function MatchFilterStrip({
  filters,
  onChange,
  onSubmit,
  cineGraph,
  locked,
  advancedLocked,
  viewer,
  loading,
  onSpinComplete,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const genreKeys = MATCH_GENRE_KEYS[filters.type];
  const allGenresSelected = genreKeys.length > 0 && genreKeys.every((g) => filters.genres.includes(g));
  const allFiltersSelected = filters.useCount && filters.useAvgRating;
  const hasGenre = filters.genres.length > 0;
  const hasSignal = filters.useCount || filters.useAvgRating;
  // Both a genre AND a signal are required — either alone isn't enough to
  // run a meaningful match query.
  const hasAnyCriterion = hasGenre && hasSignal;
  const disabledReason = hasAnyCriterion
    ? null
    : !hasGenre && !hasSignal
    ? t("Select at least one genre and one filter method to find your match.")
    : !hasGenre
    ? t("Select at least one genre to find your match.")
    : t("Select at least one filter method (Watched Count or Average Rating).");

  const stats = cineGraph?.isAuthorized ? (filters.type === "movie" ? cineGraph.movieStats : cineGraph.seriesStats) : {};

  const toggleGenre = (genre: string) => {
    const genres = filters.genres.includes(genre) ? filters.genres.filter((g) => g !== genre) : [...filters.genres, genre];
    onChange({ ...filters, genres });
  };
  // Derived, not stored — "all selected" is recomputed from the actual
  // genres array every render, so manually deselecting even one genre after
  // tapping this immediately reverts its own checked look back to empty,
  // with no separate state to keep in sync.
  const toggleApplyAllGenres = () => onChange({ ...filters, genres: allGenresSelected ? [] : genreKeys });
  const toggleApplyAllFilters = () => onChange({ ...filters, useCount: !allFiltersSelected, useAvgRating: !allFiltersSelected });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardWrap: { position: "relative" },
        card: { backgroundColor: colors.base200, borderRadius: 16, paddingVertical: 16, marginHorizontal: 16, marginTop: 8 },
        locked: { opacity: 0.5 },
        lockNotice: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 16 },
        lockNoticeText: { fontSize: 12, color: colors.placeholder, flex: 1 },
        advancedLockHint: { textAlign: "center", paddingHorizontal: 24, marginTop: 8, textDecorationLine: "underline" },
        switcherWrap: { alignItems: "center" },
        infoNote: { fontSize: 12, color: colors.placeholder, textAlign: "center", lineHeight: 17, marginTop: 12, paddingHorizontal: 20 },
        // "Watched Count" / "Average Rating" — moved between the info note
        // and the ring, side by side with equal/optimum spacing (was two
        // full-width stacked rows below the ring before).
        signalsRow: { flexDirection: "row", justifyContent: "space-evenly", marginTop: 16, paddingHorizontal: 16 },
        signalUnit: { flexDirection: "row", alignItems: "center", gap: 8 },
        signalLabel: { color: colors.baseContent, fontSize: 13, fontFamily: fonts.medium },
        // Apply All Genres / Apply All Filters — a round checkbox on the
        // left of each label, no bordered box around the pair anymore, both
        // side by side with equal/optimum spacing (was two stacked full-
        // width bordered rows before).
        applyRow: { flexDirection: "row", justifyContent: "space-evenly", marginTop: 16, paddingHorizontal: 16 },
        applyUnit: { flexDirection: "row", alignItems: "center", gap: 8 },
        checkCircle: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        checkCircleActive: { backgroundColor: colors.placeholder, borderColor: colors.placeholder },
        applyUnitText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        matchButtonWrap: { alignSelf: "center", marginTop: 20, borderRadius: MATCH_BUTTON_HEIGHT / 2, overflow: "hidden" },
        matchButton: { width: MATCH_BUTTON_WIDTH, height: MATCH_BUTTON_HEIGHT, alignItems: "center", justifyContent: "center" },
        matchButtonDisabled: { opacity: 0.4 },
        matchButtonText: { color: "#fff", fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.3 },
        disabledReasonText: { color: colors.placeholder, fontSize: 11.5, textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
      }),
    [colors]
  );

  const goToSubscription = () => router.push("/match/subscription" as any);

  return (
    <View>
      <View style={styles.cardWrap}>
        <View style={[styles.card, locked && styles.locked]} pointerEvents={locked ? "none" : "auto"}>
          {locked && (
            <View style={styles.lockNotice}>
              <Ionicons name="lock-closed" size={14} color={colors.placeholder} />
              <Text style={styles.lockNoticeText}>{t("Upgrade to Plus or Premium to customize match filters.")}</Text>
            </View>
          )}

          <View style={styles.switcherWrap}>
            <CineGraphSubTabSwitcher activeTab={filters.type} onChange={(type) => onChange({ ...filters, type, genres: [] })} />
          </View>

          <Text style={styles.infoNote}>{t("Find your closest match on Cinephix. Tap your whole CineGraph or just the genres you want to filter by.")}</Text>

          <View style={styles.signalsRow}>
            <View style={[styles.signalUnit, advancedLocked && styles.locked]} pointerEvents={advancedLocked ? "none" : "auto"}>
              <Text style={styles.signalLabel}>{t("Watched Count")}</Text>
              {advancedLocked ? (
                <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
              ) : (
                <Switch
                  value={filters.useCount}
                  onValueChange={(v) => onChange({ ...filters, useCount: v })}
                  trackColor={{ true: hexToRgba(colors.baseContent, 0.3), false: colors.border }}
                  thumbColor={filters.useCount ? "#fff" : colors.placeholder}
                />
              )}
            </View>
            <View style={[styles.signalUnit, advancedLocked && styles.locked]} pointerEvents={advancedLocked ? "none" : "auto"}>
              <Text style={styles.signalLabel}>{t("Average Rating")}</Text>
              {advancedLocked ? (
                <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
              ) : (
                <Switch
                  value={filters.useAvgRating}
                  onValueChange={(v) => onChange({ ...filters, useAvgRating: v })}
                  trackColor={{ true: hexToRgba(colors.baseContent, 0.3), false: colors.border }}
                  thumbColor={filters.useAvgRating ? "#fff" : colors.placeholder}
                />
              )}
            </View>
          </View>
          {advancedLocked && !locked && (
            <Pressable onPress={goToSubscription}>
              <Text style={[styles.lockNoticeText, styles.advancedLockHint]}>{t("Upgrade to Premium to weight matches by watch count or average rating.")}</Text>
            </Pressable>
          )}

          <CineMatchGenreRing
            stats={stats}
            type={filters.type}
            selectedGenres={filters.genres}
            onToggleGenre={toggleGenre}
            userId={viewer._id}
            username={viewer.username}
            profilePicUrl={viewer.profile_pic_url}
            loading={!!loading}
            onSpinComplete={onSpinComplete}
          />

          <View style={styles.applyRow}>
            <Pressable style={styles.applyUnit} onPress={toggleApplyAllGenres}>
              <View style={[styles.checkCircle, allGenresSelected && styles.checkCircleActive]}>
                {allGenresSelected && <Ionicons name="checkmark" size={14} color={colors.baseContent} />}
              </View>
              <Text style={styles.applyUnitText}>{t("Apply All Genres")}</Text>
            </Pressable>
            <Pressable
              style={styles.applyUnit}
              onPress={toggleApplyAllFilters}
              disabled={advancedLocked}
              pointerEvents={advancedLocked ? "none" : "auto"}
            >
              <View style={[styles.checkCircle, allFiltersSelected && styles.checkCircleActive]}>
                {allFiltersSelected && <Ionicons name="checkmark" size={14} color={colors.baseContent} />}
              </View>
              <Text style={styles.applyUnitText}>{t("Apply All Filters")}</Text>
            </Pressable>
          </View>
        </View>

        {locked && <Pressable style={StyleSheet.absoluteFill} onPress={goToSubscription} />}
      </View>

      {/* Outside the locked/pointerEvents-none wrapper on purpose — Free
          tier can still run a search (the server silently applies its
          default filters regardless of what's selected here), it just
          can't customize what's searched. */}
      <Pressable
        style={[styles.matchButtonWrap, !locked && !hasAnyCriterion && !loading && styles.matchButtonDisabled]}
        onPress={onSubmit}
        disabled={loading || (!locked && !hasAnyCriterion)}
      >
        <Svg width={MATCH_BUTTON_WIDTH} height={MATCH_BUTTON_HEIGHT} style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id="matchButtonGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.secondary} />
            </LinearGradient>
          </Defs>
          <Rect width={MATCH_BUTTON_WIDTH} height={MATCH_BUTTON_HEIGHT} fill="url(#matchButtonGradient)" />
        </Svg>
        <View style={styles.matchButton}>
          <Text style={styles.matchButtonText}>{t("Sync")}</Text>
        </View>
      </Pressable>
      {!locked && !loading && disabledReason && <Text style={styles.disabledReasonText}>{disabledReason}</Text>}
    </View>
  );
}
