import { useMemo } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import CineGraphSubTabSwitcher from "../profile/CineGraphSubTabSwitcher";
import CineMatchGenreRing, { MATCH_GENRE_KEYS } from "./CineMatchGenreRing";
import { useToast } from "../../context/ToastContext";
import type { CineGraphData, MatchUser } from "../../types";
import type { MatchFilters } from "../../api/matchService";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
  onSubmit: () => void;
  cineGraph: CineGraphData | null;
  // Free tier — genre selection (the ring, Apply All Genres, Apply All
  // Filters) is non-functional; tapping any of it shows a toast instead of
  // either silently doing nothing or jumping straight to the subscription
  // page (the latter was reported as jarring — direct navigation now lives
  // only on the dedicated Upgrade badge, match/index.tsx's own). The type
  // switcher (Movies/Series) stays fully functional regardless — the
  // server now honors `type` for every tier, only genres/weighting stay
  // gated. Visually unchanged from the fully-unlocked look (no dimming) —
  // an earlier version of this dimmed the whole card, reported as making
  // the CineGraph ring itself look muted, reverted.
  locked: boolean;
  // Plus tier — type/genre stay usable, but the useCount/useAvgRating
  // weighting toggles (and the "Apply All Filters" shortcut, which toggles
  // the same two) are still forced true/true server-side regardless of
  // what's sent — tapping them shows the same toast treatment as `locked`,
  // scoped to just those controls.
  advancedLocked: boolean;
  viewer: MatchUser;
  // True while the ring's own collapse/spin loading animation is running —
  // disables the ring, the Match button, and hides the disabled-reason note.
  loading?: boolean;
  // Threaded straight through to CineMatchGenreRing's own onSpinComplete —
  // see that component's own prop comment for why match/index.tsx needs
  // this real completion signal instead of a guessed-duration timer.
  onSpinComplete?: () => void;
  // The whole "Upgrade" ribbon element (match/index.tsx's own UpgradeRibbon),
  // rendered as an absolutely-positioned corner banner on this card — direct
  // ask, moved off the plain badge-below-the-Sync-button placement an
  // earlier round used (see git history/README) in favor of something more
  // "ön planda" (front-and-center prominent). Built and owned by the caller
  // (same navigation it always had); this file only positions it.
  upgradeButton?: React.ReactNode;
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
  upgradeButton,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();

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

  const stats = cineGraph ? (filters.type === "movie" ? cineGraph.movieStats : cineGraph.seriesStats) : {};

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
        // Only added alongside the ribbon (see upgradeButton's own render
        // below) — clips its diagonal overhang to this card's own rounded
        // corner instead of spilling past it. Never applied otherwise, so
        // Premium/dev (no ribbon at all) keep the card's plain, unclipped
        // behavior exactly as before.
        cardClipped: { overflow: "hidden" },
        restWrap: { position: "relative" },
        // justifyContent:"center" (not the row's own default left-packed
        // flow) so the icon+text pair sits centered as a unit — direct ask,
        // this used to start flush against the left edge instead. Shared by
        // both the Free-only full-filters notice (below) and the Plus-only
        // advanced-filters hint (advancedLocked && !locked, above), which
        // used to be two visually different treatments (one an icon row,
        // one bare centered text) for the same kind of message.
        lockNotice: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, marginBottom: 4, paddingHorizontal: 24 },
        lockNoticeText: { fontSize: 12, color: colors.placeholder, textAlign: "center", textDecorationLine: "underline", flexShrink: 1 },
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
        // Top-right corner of `card` (the dark box CineGraph sits in) —
        // direct ask ("ön planda olmalı... koyu renkli arkaplan butonunun
        // sol ya da sağ köşesine bant gibi"). `card` gains overflow:"hidden"
        // only in the branch that actually renders this (see below), so the
        // ribbon's own diagonal overhang gets trimmed to the card's rounded
        // corner instead of spilling past it — never applied when there's
        // no ribbon to clip, zero risk to any other tier's card.
        upgradeRibbonWrap: { position: "absolute", top: 14, right: -32 },
      }),
    [colors]
  );

  const upgradeFiltersMessage = t("Upgrade to Plus or Premium to customize match filters.");
  const upgradeAdvancedMessage = t("Upgrade to Premium to weight matches by watch count or average rating.");

  return (
    <View>
      <View style={styles.cardWrap}>
        <View style={[styles.card, !!upgradeButton && styles.cardClipped]}>
          {upgradeButton && <View style={styles.upgradeRibbonWrap}>{upgradeButton}</View>}
          {/* Always interactive, every tier — the server now honors `type`
              regardless of account tier, only genres/weighting stay gated. */}
          <View style={styles.switcherWrap}>
            <CineGraphSubTabSwitcher activeTab={filters.type} onChange={(type) => onChange({ ...filters, type, genres: [] })} />
          </View>

          <Text style={styles.infoNote}>{t("Find your closest match on Cinephix. Tap your whole CineGraph or just the genres you want to filter by.")}</Text>

          <View style={styles.restWrap}>
            <View style={styles.signalsRow}>
              <Pressable
                style={styles.signalUnit}
                onPress={advancedLocked ? () => showToast(upgradeAdvancedMessage) : undefined}
              >
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
              </Pressable>
              <Pressable
                style={styles.signalUnit}
                onPress={advancedLocked ? () => showToast(upgradeAdvancedMessage) : undefined}
              >
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
              </Pressable>
            </View>
            {advancedLocked && !locked && (
              <Pressable style={styles.lockNotice} onPress={() => showToast(upgradeAdvancedMessage)}>
                <Ionicons name="lock-closed" size={14} color={colors.placeholder} />
                <Text style={styles.lockNoticeText}>{upgradeAdvancedMessage}</Text>
              </Pressable>
            )}

            <CineMatchGenreRing
              stats={stats}
              type={filters.type}
              selectedGenres={filters.genres}
              onToggleGenre={locked ? () => {} : toggleGenre}
              userId={viewer._id}
              username={viewer.username}
              profilePicUrl={viewer.profile_pic_url}
              loading={!!loading}
              onSpinComplete={onSpinComplete}
            />

            <View style={styles.applyRow}>
              <Pressable style={styles.applyUnit} onPress={locked ? () => showToast(upgradeFiltersMessage) : toggleApplyAllGenres}>
                <View style={[styles.checkCircle, allGenresSelected && styles.checkCircleActive]}>
                  {allGenresSelected && <Ionicons name="checkmark" size={14} color={colors.baseContent} />}
                </View>
                <Text style={styles.applyUnitText}>{t("Apply All Genres")}</Text>
              </Pressable>
              <Pressable
                style={styles.applyUnit}
                onPress={
                  locked
                    ? () => showToast(upgradeFiltersMessage)
                    : advancedLocked
                    ? () => showToast(upgradeAdvancedMessage)
                    : toggleApplyAllFilters
                }
              >
                <View style={[styles.checkCircle, allFiltersSelected && styles.checkCircleActive]}>
                  {allFiltersSelected && <Ionicons name="checkmark" size={14} color={colors.baseContent} />}
                </View>
                <Text style={styles.applyUnitText}>{t("Apply All Filters")}</Text>
              </Pressable>
            </View>

            {/* Free only — a single tap-catching overlay over the genre
                ring/apply row (the ring's own ScrollView would otherwise eat
                a tap before it reaches a wrapping Pressable) so tapping
                anywhere in this region shows the same toast rather than
                silently doing nothing. Type switcher above is outside this
                overlay entirely, and stays real. */}
            {locked && (
              <Pressable style={StyleSheet.absoluteFill} onPress={() => showToast(upgradeFiltersMessage)} />
            )}
          </View>
        </View>
      </View>

      {/* Moved here from the top of the card, direct ask — sits between
          Apply Filters (just above) and the Sync button (just below)
          instead of leading the whole card. */}
      {locked && (
        <View style={styles.lockNotice}>
          <Ionicons name="lock-closed" size={14} color={colors.placeholder} />
          <Text style={styles.lockNoticeText}>{upgradeFiltersMessage}</Text>
        </View>
      )}

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
