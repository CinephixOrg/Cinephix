import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, LayoutAnimation, RefreshControl, StyleSheet, Text, View } from "react-native";
import Pressable from "../../../src/components/common/TapSafePressable";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PersonalActivityRow, { createActivityRowStyles } from "../../../src/components/profile/PersonalActivityRow";
import HeaderPopover, { PopoverLabel, PopoverReset, usePopoverStyles } from "../../../src/components/popover/HeaderPopover";
import { SkeletonBox } from "../../../src/components/Skeleton";
import { useMyActivity } from "../../../src/hooks/useMyActivity";
import { useAuth } from "../../../src/context/AuthContext";
import { prefetchActivity } from "../../../src/api/personalActivityCache";
import { dayHeading } from "../../../src/utils/chatMessages";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_RANGES,
  CATEGORY_LABEL,
  hiddenCategoryCount,
  shownCategories,
  DEFAULT_ACTIVITY_FILTERS,
  RANGE_LABEL,
  activityRows,
  toggleCategory,
  type ActivityCategory,
  type ActivityFilters,
  type ActivityRange,
  type ActivityRow,
} from "../../../src/utils/personalActivity";
import type { PersonalActivityItem } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type IconName = keyof typeof Ionicons.glyphMap;

// A filter change fades rows out and slides the rest into place.
const REFLOW = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

const CATEGORY_ICON: Record<ActivityCategory, IconName> = {
  ratings: "star-outline",
  reviews: "create-outline",
  likes: "heart-outline",
  list_likes: "heart-circle-outline",
  follows: "person-add-outline",
  lists: "albums-outline",
  watched: "checkmark-done-outline",
  favorites: "heart-half-outline",
  communities: "people-outline",
  shares: "share-social-outline",
  cinematch: "pulse-outline",
};

/** "This Week ⌄": a pill in the header that drops the time-range menu. */
const RangeMenu = memo(function RangeMenu({ range, onChange }: { range: ActivityRange; onChange: (range: ActivityRange) => void }) {
  const { t } = useTranslation();
  const { styles, colors } = usePopoverStyles();
  return (
    <HeaderPopover icon="chevron-down" text={t(RANGE_LABEL[range])} label={t("Time range")} count={0}>
      <PopoverLabel text={t("Time range")} styles={styles} />
      {ACTIVITY_RANGES.map((option) => {
        const selected = option === range;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <View style={[styles.optionIcon, { backgroundColor: selected ? `${colors.primary}22` : colors.base200 }]}>
              <Ionicons
                name={option === "all" ? "infinite-outline" : option === "month" ? "calendar-outline" : "today-outline"}
                size={15}
                color={selected ? colors.primary : colors.baseContent}
              />
            </View>
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>{t(RANGE_LABEL[option])}</Text>
            <View style={styles.check}>{selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}</View>
          </Pressable>
        );
      })}
    </HeaderPopover>
  );
});

/**
 * The "Activity type" menu, a checklist: everything is ticked by default,
 * so hiding one type is one tap. "All activity" ticks everything again.
 */
const TypeMenu = memo(function TypeMenu({
  filters,
  onToggle,
  onClear,
}: {
  filters: ActivityFilters;
  onToggle: (category: ActivityCategory) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { styles, colors } = usePopoverStyles();
  const all = filters.categories.length === 0;
  const shown = shownCategories(filters);
  return (
    <HeaderPopover icon="options-outline" label={t("Activity type")} count={hiddenCategoryCount(filters)}>
      <PopoverLabel text={t("Activity type")} styles={styles} />
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityState={{ selected: all }}
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
      >
        <View style={[styles.optionIcon, { backgroundColor: all ? `${colors.primary}22` : colors.base200 }]}>
          <Ionicons name="apps-outline" size={15} color={all ? colors.primary : colors.baseContent} />
        </View>
        <Text style={[styles.optionText, all && styles.optionTextActive]}>{t("All activity")}</Text>
        <View style={styles.check}>{all ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}</View>
      </Pressable>
      {ACTIVITY_CATEGORIES.map((category) => {
        const selected = shown.includes(category);
        // The last ticked type can't be unticked (toggleCategory refuses it).
        const locked = selected && shown.length === 1;
        return (
          <Pressable
            key={category}
            onPress={() => onToggle(category)}
            disabled={locked}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: locked }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <View style={[styles.optionIcon, { backgroundColor: selected ? `${colors.primary}22` : colors.base200 }]}>
              <Ionicons name={CATEGORY_ICON[category]} size={15} color={selected ? colors.primary : colors.baseContent} />
            </View>
            {/* Long labels ("CineMatch & CineGraph", longer in some
                languages) shrink a little to fit rather than being cut off. */}
            <Text
              style={[styles.optionText, selected && styles.optionTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {t(CATEGORY_LABEL[category])}
            </Text>
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={20}
              color={selected ? colors.primary : colors.placeholder}
            />
          </Pressable>
        );
      })}
      {!all ? <PopoverReset label={t("Show all activity")} onPress={onClear} styles={styles} colors={colors} /> : null}
    </HeaderPopover>
  );
});

/** "Today", "Yesterday", "Monday", "3 September" — between one day's activity and the next. */
const DayHeader = memo(function DayHeader({ iso, style }: { iso: string; style: object }) {
  const { t, i18n } = useTranslation();
  const text = dayHeading(iso, new Date(), i18n.language, { today: t("Today"), yesterday: t("Yesterday") });
  return (
    <Text style={style} accessibilityRole="header">
      {text}
    </Text>
  );
});

function SkeletonActivity({ styles }: { styles: ReturnType<typeof createScreenStyles> }) {
  return (
    <View style={styles.list}>
      <SkeletonBox width={90} height={13} style={{ marginTop: 18, marginBottom: 10, marginLeft: 10 }} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonBox width={38} height={38} borderRadius={13} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox width="85%" height={13} />
            <SkeletonBox width="35%" height={11} />
          </View>
          <SkeletonBox width={33} height={54} borderRadius={7} />
        </View>
      ))}
    </View>
  );
}

function createScreenStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.base100 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    list: { paddingHorizontal: 8, paddingBottom: 32 },
    day: {
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 0.2,
      color: colors.placeholder,
      paddingHorizontal: 10,
      paddingTop: 18,
      paddingBottom: 4,
    },
    skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 10 },
    state: { alignItems: "center", paddingTop: 72, paddingHorizontal: 36, gap: 10 },
    stateIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
      marginBottom: 6,
    },
    stateTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent, textAlign: "center" },
    stateText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
    stateButton: { marginTop: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.base200 },
    stateButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
  });
}

// Your own footprint in the app: every rating, review, like, follow, list,
// share and analysis, newest first under a header per day.
//
// Time range and activity type live in the header as dropdowns. Each filter
// combination is cached (personalActivityCache.ts), so switching between
// them shows the list at once and only refreshes underneath, and the other
// time ranges are fetched in the background once the first one is in.
export default function ProfileActivityScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  const rowStyles = useMemo(() => createActivityRowStyles(colors), [colors]);

  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_ACTIVITY_FILTERS);
  const { items, hasMore, loading, failed, refreshing, loadingMore, refresh, retry, loadMore } = useMyActivity(filters);
  const rows = useMemo(() => activityRows(items), [items]);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const changeFilters = useCallback((update: (current: ActivityFilters) => ActivityFilters) => {
    const current = filtersRef.current;
    const next = update(current);
    if (next.range === current.range && next.categories.join() === current.categories.join()) return;
    LayoutAnimation.configureNext(REFLOW);
    setFilters(next);
  }, []);

  const setRange = useCallback((range: ActivityRange) => changeFilters((f) => ({ ...f, range })), [changeFilters]);
  const toggle = useCallback((category: ActivityCategory) => changeFilters((f) => toggleCategory(f, category)), [changeFilters]);
  const clearTypes = useCallback(() => changeFilters((f) => ({ ...f, categories: [] })), [changeFilters]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <RangeMenu range={filters.range} onChange={setRange} />
          <TypeMenu filters={filters} onToggle={toggle} onClear={clearTypes} />
        </View>
      ),
    });
  }, [navigation, filters, setRange, toggle, clearTypes, styles.headerActions]);

  // Once this view has loaded, the other time ranges for the same types
  // load quietly, so switching range is instant too.
  useEffect(() => {
    if (loading) return;
    for (const range of ACTIVITY_RANGES) if (range !== filters.range) prefetchActivity({ ...filters, range });
  }, [loading, filters]);

  // Each tap opens its page inside the Profile stack, so Back comes back here.
  const open = useCallback(
    (item: PersonalActivityItem) => {
      if (item.type === "list_created" || item.type === "list_liked") {
        if (item.listId) router.push(`/profile/lists/${item.listId}` as never);
      } else if (item.content) {
        router.push(`/profile/content/${item.content.type}/${item.content.id}` as never);
      } else if ((item.type === "followed" || item.type === "match_analyzed") && item.targetUser) {
        router.push(`/user/${item.targetUser._id}`);
      } else if (item.type === "group_joined" && item.groupSlug) {
        router.push(`/socials/communities/${item.groupSlug}`);
      } else if (item.type === "shared" && item.shareId && user?._id) {
        router.push(`/user/${user._id}/shares/${item.shareId}` as never);
      }
    },
    [router, user?._id]
  );

  const renderItem = useCallback(
    ({ item }: { item: ActivityRow }) =>
      item.kind === "day" ? (
        <DayHeader iso={item.iso} style={styles.day} />
      ) : (
        <PersonalActivityRow item={item.item} styles={rowStyles} onPress={item.item.type === "profile_analyzed" ? undefined : open} />
      ),
    [styles.day, rowStyles, open]
  );

  const narrowed = filters.categories.length > 0;

  if (loading) {
    return (
      <View style={styles.screen}>
        <SkeletonActivity styles={styles} />
      </View>
    );
  }

  if (failed && items.length === 0) {
    return (
      <View style={[styles.screen, styles.state]}>
        <View style={styles.stateIcon}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.placeholder} />
        </View>
        <Text style={styles.stateText}>{t("Couldn't load your activity.")}</Text>
        <Pressable style={({ pressed }) => [styles.stateButton, pressed && { opacity: 0.7 }]} onPress={retry}>
          <Text style={styles.stateButtonText}>{t("Try again")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.5}
      initialNumToRender={14}
      windowSize={9}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="footsteps-outline" size={30} color={colors.placeholder} />
          </View>
          <Text style={styles.stateTitle}>{t("Nothing here yet")}</Text>
          <Text style={styles.stateText}>
            {filters.range === "all"
              ? t("Rate, review, follow and share, and it will all show up here.")
              : t("No activity in this time range. Try a longer one.")}
          </Text>
          {narrowed || filters.range !== "all" ? (
            <Pressable
              style={({ pressed }) => [styles.stateButton, pressed && { opacity: 0.7 }]}
              onPress={() => changeFilters(() => ({ range: "all", categories: [] }))}
            >
              <Text style={styles.stateButtonText}>{t("Show all activity")}</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}
