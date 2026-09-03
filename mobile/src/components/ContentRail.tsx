import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
// From react-native-gesture-handler, not react-native — this rail's own
// horizontal scroll nests inside Discover's outer horizontal page-switcher
// (home/index.tsx); it needs gesture-handler's pan resolution to keep
// working, see that file's comment for why.
import { FlatList } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props<T> {
  title: string;
  subtitle?: string;
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
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
        <Text style={styles.title}>{title}</Text>
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
        </View>
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={height ? { height } : undefined}>
        {data.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={data}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.railContent}
            renderItem={({ item, index }) => <>{renderItem(item, index)}</>}
          />
        )}
      </View>
    </View>
  );
}
