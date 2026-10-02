import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import SheetModal, { SheetHeader } from "./SheetModal";
import { RATED_LABEL, RATED_OPTIONS, TYPE_LABEL, TYPE_OPTIONS, priorityOf, type SortGroupSpec } from "./filterLabels";
import {
  activeFilterCount,
  type CollectionFilters,
  type ContentKind,
  type FilterAction,
  type RatedFilter,
  type SortRule,
} from "../../utils/collectionQuery";

type Colors = ReturnType<typeof useTheme>["colors"];
type OnAction = (action: FilterAction) => void;

function createStyles(colors: Colors, bottomInset: number) {
  return StyleSheet.create({
    body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 },
    section: { gap: 10 },
    sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder },
    typeRow: { flexDirection: "row", gap: 10 },
    typeCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      borderColor: colors.border,
      backgroundColor: colors.base200,
    },
    typeCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
    typeLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    typeLabelActive: { color: colors.primary },
    pressedScale: { transform: [{ scale: 0.97 }] },
    sortRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    sortLabel: { width: 96, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
    segment: {
      flex: 1,
      flexDirection: "row",
      height: 42,
      borderRadius: 12,
      padding: 3,
      gap: 3,
      backgroundColor: colors.base200,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9 },
    segmentOptionActive: { backgroundColor: colors.primary },
    segmentOptionPressed: { backgroundColor: colors.base300 },
    segmentText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
    segmentTextActive: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryContent },
    priority: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryContent,
    },
    priorityText: { fontFamily: fonts.bold, fontSize: 10, color: colors.primary },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: bottomInset + 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    clearButton: {
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
    },
    disabled: { opacity: 0.4 },
    pressedFade: { opacity: 0.7 },
    clearText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
    showButton: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    pressedShow: { transform: [{ scale: 0.98 }] },
    showText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
  });
}

type Styles = ReturnType<typeof createStyles>;

// ---------------------------------------------------------------------------
// Options and sections
//
// The sheet is split into memoized pieces fed only the slice of filter state
// they show. reduceFilters keeps untouched slices by reference, so picking a
// sort re-renders the Sort section's affected options and nothing else: the
// type cards, the rating row and every unchanged option skip rendering.
// ---------------------------------------------------------------------------

const TypeOption = memo(function TypeOption({
  kind,
  icon,
  active,
  action,
  onAction,
  styles,
  colors,
}: {
  kind: ContentKind;
  icon: "film-outline" | "tv-outline";
  active: boolean;
  action: FilterAction;
  onAction: OnAction;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onAction(action)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.typeCard, active && styles.typeCardActive, pressed && styles.pressedScale]}
    >
      <Ionicons name={icon} size={20} color={active ? colors.primary : colors.baseContent} />
      <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(TYPE_LABEL[kind])}</Text>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={20} color={active ? colors.primary : colors.border} />
    </Pressable>
  );
});

const SegmentOption = memo(function SegmentOption({
  label,
  active,
  priority,
  action,
  onAction,
  styles,
}: {
  label: string;
  active: boolean;
  /** Shown when above 0. */
  priority: number;
  action: FilterAction;
  onAction: OnAction;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={() => onAction(action)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.segmentOption,
        active ? styles.segmentOptionActive : pressed && styles.segmentOptionPressed,
      ]}
    >
      <Text style={active ? styles.segmentTextActive : styles.segmentText} numberOfLines={1}>
        {label}
      </Text>
      {priority > 0 ? (
        <View style={styles.priority}>
          <Text style={styles.priorityText}>{priority}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const TypeSection = memo(function TypeSection({
  types,
  onAction,
  styles,
  colors,
}: {
  types: ContentKind[];
  onAction: OnAction;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("Type")}</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((option) => (
          <TypeOption
            key={option.kind}
            kind={option.kind}
            icon={option.icon}
            active={types.includes(option.kind)}
            action={option.action}
            onAction={onAction}
            styles={styles}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
});

const SortSection = memo(function SortSection({
  sorts,
  groups,
  onAction,
  styles,
}: {
  sorts: SortRule[];
  groups: SortGroupSpec[];
  onAction: OnAction;
  styles: Styles;
}) {
  const { t } = useTranslation();
  // With more than one sort active, each shows its priority number so the
  // order they apply in is visible.
  const showPriority = sorts.length > 1;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("Sort by")}</Text>
      {groups.map((group) => (
        <View key={group.group} style={styles.sortRow}>
          <Text style={styles.sortLabel} numberOfLines={2}>
            {t(group.label)}
          </Text>
          <View style={styles.segment}>
            {group.options.map((option) => {
              const priority = priorityOf(sorts, group.group, option.direction);
              return (
                <SegmentOption
                  key={option.direction}
                  label={group.group === "alpha" ? option.label : t(option.label)}
                  active={priority > 0}
                  priority={showPriority ? priority : 0}
                  action={option.action}
                  onAction={onAction}
                  styles={styles}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
});

const RatedSection = memo(function RatedSection({
  rated,
  onAction,
  styles,
}: {
  rated: RatedFilter | null;
  onAction: OnAction;
  styles: Styles;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("Rating")}</Text>
      <View style={styles.segment}>
        {RATED_OPTIONS.map((option) => (
          <SegmentOption
            key={option.value}
            label={t(RATED_LABEL[option.value])}
            active={rated === option.value}
            priority={0}
            action={option.action}
            onAction={onAction}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
});

const CLEAR_ACTION: FilterAction = { kind: "clear" };

const Footer = memo(function Footer({
  canClear,
  resultCount,
  onAction,
  onClose,
  styles,
}: {
  canClear: boolean;
  resultCount: number;
  onAction: OnAction;
  onClose: () => void;
  styles: Styles;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.footer}>
      <Pressable
        onPress={() => onAction(CLEAR_ACTION)}
        disabled={!canClear}
        accessibilityRole="button"
        style={({ pressed }) => [styles.clearButton, !canClear && styles.disabled, pressed && styles.pressedFade]}
      >
        <Text style={styles.clearText}>{t("Clear all")}</Text>
      </Pressable>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [styles.showButton, pressed && styles.pressedShow]}
      >
        <Text style={styles.showText}>{t("Show {{count}} titles", { count: resultCount })}</Text>
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: CollectionFilters;
  onAction: OnAction;
  /** How many titles the current filters and search leave. */
  resultCount: number;
  sortGroups: SortGroupSpec[];
  /** The Rated / Not Rated filter (Watched Lists only). */
  showRatedFilter: boolean;
}

// Filter menu shared by every collection view.
//
// Every option applies the moment it is tapped, and the footer button shows
// the live result count, so there is no separate "apply" step to forget.
// Options in the same group are mutually exclusive (see reduceFilters);
// options in different groups combine.
function CollectionFilterSheet({
  visible,
  onClose,
  filters,
  onAction,
  resultCount,
  sortGroups,
  showRatedFilter,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);

  return (
    <SheetModal visible={visible} onClose={onClose} header={<SheetHeader title={t("Filters")} onClose={onClose} />}>
      <ScrollView contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
        <TypeSection types={filters.types} onAction={onAction} styles={styles} colors={colors} />
        <SortSection sorts={filters.sorts} groups={sortGroups} onAction={onAction} styles={styles} />
        {showRatedFilter ? <RatedSection rated={filters.rated} onAction={onAction} styles={styles} /> : null}
      </ScrollView>

      <Footer
        canClear={activeFilterCount(filters) > 0}
        resultCount={resultCount}
        onAction={onAction}
        onClose={onClose}
        styles={styles}
      />
    </SheetModal>
  );
}

export default memo(CollectionFilterSheet);
