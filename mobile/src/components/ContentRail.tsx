import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
// From react-native-gesture-handler, not react-native — this rail's own
// horizontal scroll nests inside Discover's outer horizontal page-switcher
// (home/index.tsx); it needs gesture-handler's pan resolution to keep
// working, see that file's comment for why.
import { FlatList } from "react-native-gesture-handler";
import DraggableFlatList from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Passed as renderItem's 3rd argument only when dragEnabled — undefined for
// every other caller of this rail, and for the (non-draggable) empty
// add-slots a Favorites caller renders via `footer` instead of `data`.
// `onActivate` (renamed from an original `onLongPress`) is meant to be
// wired to the card's own onPressIn, not onLongPress — direct ask, picking
// a card up should start the instant a press lands, no hold-and-wait.
export interface RailDragHandle {
  onActivate: () => void;
  isActive: boolean;
}

interface Props<T> {
  title: string;
  subtitle?: string;
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number, drag?: RailDragHandle) => React.ReactNode;
  emptyText: string;
  // Optional trailing link next to the title (e.g. "See all" pointing at the
  // full screen this rail is a preview of).
  onSeeAllPress?: () => void;
  seeAllLabel?: string;
  // Optional trailing pencil icon next to the title (e.g. opening an edit
  // screen for the underlying list) — mutually exclusive with onSeeAllPress
  // in practice, but both can render together if a caller ever needs it.
  onEditPress?: () => void;
  editLabel?: string;
  // Fixed height for the scrollable card area (title/subtitle stay natural
  // height) — keeps a group of rails visually uniform regardless of how
  // much content or empty-state text each one has.
  height?: number;
  // Arbitrary trailing content next to the title, alongside (or instead
  // of) See all/Edit — added for CurrentlyWatchingSection.tsx's own All/
  // Friends mode toggle, which isn't a link or an edit action so neither
  // existing slot fit it.
  headerRight?: React.ReactNode;
  // Content right after the title rather than at the row's far end — New
  // Releases' Movies/Series toggle, placed where the podium above it has
  // the same toggle.
  titleAccessory?: React.ReactNode;
  // Makes `data` itself drag-to-reorder (long-press a card to pick it up),
  // added for the profile Favorites rails' own edit mode — direct ask,
  // "watchedlistteki gibi" but for reordering rather than removal. Off by
  // default; every other caller of this shared rail is unaffected.
  dragEnabled?: boolean;
  // Called with the FULL reordered array once a drag ends — the caller
  // owns persisting it (an optimistic local update + an API call), same
  // division of responsibility as onEditPress/onRemove elsewhere in this
  // app; this component never talks to the network itself.
  onReorder?: (data: T[]) => void;
  // Fixed, non-draggable content rendered after `data` — the Favorites
  // rails' own empty "+" add-slots, which stay in place while real items
  // around them get reordered, same as this rail's normal (non-dragging)
  // behavior already has them trailing every real item.
  footer?: React.ReactNode;
}

// First horizontal poster-rail pattern in the app — generic over item type
// so Popular This Week / For You / Discover Lists all share one layout
// instead of three bespoke rail implementations.
export default function ContentRail<T>({
  title,
  subtitle,
  data,
  keyExtractor,
  renderItem,
  emptyText,
  onSeeAllPress,
  seeAllLabel,
  onEditPress,
  editLabel,
  height,
  headerRight,
  titleAccessory,
  dragEnabled,
  onReorder,
  footer,
}: Props<T>) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const resolvedSeeAllLabel = seeAllLabel ?? t("See all");
  const resolvedEditLabel = editLabel ?? t("Edit");
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // alignSelf:"stretch" matters when a parent uses alignItems:"center" (e.g.
        // the Profile screens) — without it the rail would shrink-wrap instead of
        // spanning full width. A no-op on parents that already stretch by default.
        section: { marginBottom: 24, alignSelf: "stretch" },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
        },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        // The podium's own title row spacing (LeaderboardPodium's titleRow gap).
        titleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
        actions: { flexDirection: "row", alignItems: "center", gap: 12 },
        seeAll: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
        editButton: { padding: 2 },
        subtitle: { fontSize: 12, color: colors.placeholder, marginTop: 2, paddingHorizontal: 16 },
        railContent: { paddingHorizontal: 16, paddingTop: 12 },
        empty: { color: colors.placeholder, fontSize: 13, paddingHorizontal: 16, marginTop: 12 },
      }),
    [colors]
  );

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        {titleAccessory ? (
          <View style={styles.titleGroup}>
            <Text style={styles.title}>{title}</Text>
            {titleAccessory}
          </View>
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
        <View style={styles.actions}>
          {onSeeAllPress && (
            <Pressable onPress={onSeeAllPress} hitSlop={8}>
              <Text style={styles.seeAll}>{resolvedSeeAllLabel}</Text>
            </Pressable>
          )}
          {onEditPress && (
            <Pressable
              onPress={onEditPress}
              hitSlop={8}
              style={styles.editButton}
              accessibilityLabel={resolvedEditLabel}
            >
              <Ionicons name="pencil" size={16} color={colors.baseContent} />
            </Pressable>
          )}
          {headerRight}
        </View>
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={height ? { height } : undefined}>
        {data.length === 0 && !footer ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : dragEnabled ? (
          <DraggableFlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={data}
            keyExtractor={(item, index) => keyExtractor(item) || String(index)}
            contentContainerStyle={styles.railContent}
            renderItem={({ item, getIndex, drag, isActive }) => (
              <>{renderItem(item, getIndex() ?? 0, { onActivate: drag, isActive })}</>
            )}
            onDragEnd={({ data: reordered }) => onReorder?.(reordered)}
            ListFooterComponent={footer ? () => <>{footer}</> : undefined}
          />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={data}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.railContent}
            renderItem={({ item, index }) => <>{renderItem(item, index)}</>}
            ListFooterComponent={footer ? () => <>{footer}</> : undefined}
          />
        )}
      </View>
    </View>
  );
}
