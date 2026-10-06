import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { WATCH_PARTY_DURATION_OPTIONS, createWatchParty } from "../api/groupService";
import { getCachedSearch, searchTitles } from "../api/listEditorData";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import { SearchResults } from "../components/lists/ListEditorParts";
import type { DraftItem } from "../utils/listDraft";
import { fonts } from "../theme/typography";

const PADDING_X = 16;
const SEARCH_DEBOUNCE_MS = 300;
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const MINUTE_STEP = 30;
const SLOTS_PER_DAY = (24 * 60) / MINUTE_STEP;
// Monday-first week headers, built from a known Mon-Sun week (2026-01-05
// is a Monday) rather than hardcoding English day names — each label is
// rendered through the viewer's own locale.
const WEEKDAY_REFERENCE = new Date(2026, 0, 5);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function durationLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

// Mon-first grid of a given month, padded with `null` for the leading/
// trailing days of neighboring months so every row is a full week.
function monthGrid(year: number, month: number): (Date | null)[][] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0..Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function ScheduleWatchPartyScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("Schedule Watch Party") });
  }, [navigation, t]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Collapsed by default ("Set a date" trigger row) — a full calendar
  // grid sitting permanently open on the page was the exact "fazlalık"
  // (clutter) direct feedback asked to avoid.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  // Tracks whether the admin has actually touched the picker yet — the
  // trigger row shows a plain "Set a date" placeholder until they have,
  // even though selectedDate/minutesOfDay already hold real (default)
  // values under the hood.
  const [hasPickedManually, setHasPickedManually] = useState(false);
  // Defaults to the next half-hour from right now, rounded up — e.g. 14:12
  // becomes 14:30. A sensible starting point rather than defaulting to midnight.
  const [minutesOfDay, setMinutesOfDay] = useState(() => {
    const now = new Date();
    return (Math.ceil((now.getHours() * 60 + now.getMinutes()) / MINUTE_STEP) * MINUTE_STEP) % (24 * 60);
  });

  const weeks = useMemo(() => monthGrid(monthCursor.year, monthCursor.month), [monthCursor]);
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(WEEKDAY_REFERENCE.getFullYear(), WEEKDAY_REFERENCE.getMonth(), WEEKDAY_REFERENCE.getDate() + i).toLocaleDateString(undefined, { weekday: "short" })),
    []
  );
  const isCurrentMonthShown = monthCursor.year === today.getFullYear() && monthCursor.month === today.getMonth();

  const timeSlots = useMemo(() => {
    const now = new Date();
    return Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
      const totalMinutes = i * MINUTE_STEP;
      const slotDate = new Date(selectedDate);
      slotDate.setMinutes(totalMinutes);
      return { minutes: totalMinutes, label: `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`, disabled: slotDate.getTime() <= now.getTime() };
    });
  }, [selectedDate]);

  // Picking a day whose current time selection is now in the past (e.g.
  // switching back to today after choosing a late-afternoon slot on a
  // future day) jumps to the first still-valid slot instead of silently
  // keeping an invalid one selected.
  useEffect(() => {
    const current = timeSlots.find((s) => s.minutes === minutesOfDay);
    if (current && !current.disabled) return;
    const firstValid = timeSlots.find((s) => !s.disabled);
    if (firstValid) setMinutesOfDay(firstValid.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const scheduledAt = useMemo(() => {
    const date = new Date(selectedDate);
    date.setMinutes(minutesOfDay);
    return date;
  }, [selectedDate, minutesOfDay]);

  const [selected, setSelected] = useState<DraftItem | null>(null);
  const [saving, setSaving] = useState(false);
  // How long this reads as "live" once it starts — default (4h) matches
  // the personal "currently watching" window; direct ask to let the
  // admin pick a longer one for a marathon or a slower-arriving group.
  const [durationMinutes, setDurationMinutes] = useState(240);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DraftItem[]>([]);
  const [searching, setSearching] = useState(false);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    const cached = getCachedSearch(trimmed);
    if (cached) {
      setResults(cached);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchTitles(trimmed)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const addedKeys = useMemo(() => new Set(selected ? [`${selected.type}:${selected.id}`] : []), [selected]);
  const pickItem = useCallback((item: DraftItem) => {
    setSelected(item);
    setQuery("");
  }, []);

  const canSave = !saving && !!selected && hasPickedManually && scheduledAt.getTime() > Date.now();

  const save = useCallback(async () => {
    if (!canSave || !selected || !slug) return;
    setSaving(true);
    try {
      await createWatchParty(slug, { contentId: selected.id, contentType: selected.type, scheduledAt: scheduledAt.toISOString(), durationMinutes });
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [canSave, selected, slug, scheduledAt, durationMinutes, router, showToast, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { paddingBottom: 140 },
        section: { paddingHorizontal: PADDING_X, paddingTop: 18, gap: 10 },
        label: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, letterSpacing: 0.4 },
        selectedRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.base200, borderRadius: 12, padding: 10 },
        selectedPoster: { width: 40, height: 60, borderRadius: 6, backgroundColor: colors.base300 },
        selectedTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
        search: { paddingHorizontal: PADDING_X, paddingTop: 10 },

        trigger: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: colors.base200,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
        },
        triggerText: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
        triggerPlaceholder: { color: colors.placeholder, fontFamily: fonts.medium },

        panel: { marginTop: 10, backgroundColor: colors.base200, borderRadius: 14, padding: 12, gap: 14 },
        monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        monthLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
        monthNavButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
        monthNavDisabled: { opacity: 0.3 },
        weekdayRow: { flexDirection: "row" },
        weekdayCell: { flex: 1, alignItems: "center", paddingBottom: 6 },
        weekdayText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.placeholder },
        dayRow: { flexDirection: "row" },
        dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
        dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
        dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
        dayCircleSelected: { backgroundColor: colors.primary },
        dayText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.baseContent },
        dayTextSelected: { fontFamily: fonts.bold, color: colors.primaryContent },
        dayTextDisabled: { color: colors.placeholder, opacity: 0.4 },

        timeStrip: { gap: 8, paddingTop: 2 },
        durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 2 },
        slotPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border },
        slotPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        slotPillDisabled: { opacity: 0.35 },
        slotText: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        slotTextActive: { color: colors.primaryContent },

        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PADDING_X,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.base100,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        saveButton: { height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
        saveDisabled: { opacity: 0.45 },
        saveText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryContent },
      }),
    [colors, insets.bottom]
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.label}>{t("Title")}</Text>
          {selected ? (
            <View style={styles.selectedRow}>
              {selected.posterPath ? <Image source={{ uri: `${POSTER_BASE}${selected.posterPath}` }} style={styles.selectedPoster} /> : null}
              <Text style={styles.selectedTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={colors.placeholder} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.search}>
          <CollectionSearchBar placeholder={t("Search movies and series")} onChangeQuery={setQuery} debounceMs={SEARCH_DEBOUNCE_MS} />
        </View>

        {hasQuery ? <SearchResults results={results} searching={searching} addedKeys={addedKeys} onToggle={pickItem} /> : null}

        <View style={styles.section}>
          <Text style={styles.label}>{t("When")}</Text>
          <Pressable style={styles.trigger} onPress={() => setPickerOpen((open) => !open)}>
            <Ionicons name="calendar-outline" size={18} color={colors.baseContent} />
            <Text style={styles.triggerText}>
              {hasPickedManually ? (
                `${scheduledAt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${scheduledAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
              ) : (
                <Text style={styles.triggerPlaceholder}>{t("Set a date")}</Text>
              )}
            </Text>
            <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.placeholder} />
          </Pressable>

          {pickerOpen ? (
            <View style={styles.panel}>
              <View style={styles.monthRow}>
                <Pressable
                  style={[styles.monthNavButton, isCurrentMonthShown && styles.monthNavDisabled]}
                  disabled={isCurrentMonthShown}
                  onPress={() => setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.baseContent} />
                </Pressable>
                <Text style={styles.monthLabel}>{new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
                <Pressable
                  style={styles.monthNavButton}
                  onPress={() => setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.baseContent} />
                </Pressable>
              </View>

              <View>
                <View style={styles.weekdayRow}>
                  {weekdayLabels.map((label, i) => (
                    <View key={i} style={styles.weekdayCell}>
                      <Text style={styles.weekdayText}>{label}</Text>
                    </View>
                  ))}
                </View>
                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.dayRow}>
                    {week.map((date, di) => {
                      if (!date) return <View key={di} style={styles.dayCell} />;
                      const isPast = date.getTime() < today.getTime();
                      const isToday = sameDay(date, today);
                      const isSelected = sameDay(date, selectedDate);
                      return (
                        <View key={di} style={styles.dayCell}>
                          <Pressable
                            style={[styles.dayCircle, isToday && !isSelected && styles.dayCircleToday, isSelected && styles.dayCircleSelected]}
                            onPress={() => {
                              if (isPast) return;
                              setSelectedDate(date);
                              setHasPickedManually(true);
                            }}
                            disabled={isPast}
                          >
                            <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isPast && styles.dayTextDisabled]}>{date.getDate()}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
                {timeSlots.map((slot) => {
                  const active = slot.minutes === minutesOfDay;
                  return (
                    <Pressable
                      key={slot.minutes}
                      style={[styles.slotPill, active && styles.slotPillActive, slot.disabled && styles.slotPillDisabled]}
                      onPress={() => {
                        if (slot.disabled) return;
                        setMinutesOfDay(slot.minutes);
                        setHasPickedManually(true);
                      }}
                      disabled={slot.disabled}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t("Stays live for")}</Text>
          <View style={styles.durationRow}>
            {WATCH_PARTY_DURATION_OPTIONS.map((minutes) => {
              const active = minutes === durationMinutes;
              return (
                <Pressable
                  key={minutes}
                  style={[styles.slotPill, active && styles.slotPillActive]}
                  onPress={() => setDurationMinutes(minutes)}
                >
                  <Text style={[styles.slotText, active && styles.slotTextActive]}>{durationLabel(minutes)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          style={({ pressed }) => [styles.saveButton, !canSave && styles.saveDisabled, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          {saving ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.saveText}>{t("Schedule Watch Party")}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
