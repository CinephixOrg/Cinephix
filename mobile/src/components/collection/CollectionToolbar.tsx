import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { activeChips } from "./filterLabels";
import type { CollectionFilters, FilterAction } from "../../utils/collectionQuery";

interface Props {
  shown: number;
  total: number;
  /** True while a search or any filter is narrowing the list. */
  narrowed: boolean;
  filters: CollectionFilters;
  onFilterAction: (action: FilterAction) => void;
  editing?: boolean;
  canEdit?: boolean;
  /** Without it there is no Edit toggle at all — a read-only collection. */
  onToggleEdit?: () => void;
}

// The row between the search bar and the grid: what's being shown, which
// filters produced it (each removable in one tap), and the Edit toggle.
function CollectionToolbar({ shown, total, narrowed, filters, onFilterAction, editing = false, canEdit = false, onToggleEdit }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const chips = useMemo(() => activeChips(filters, t), [filters, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
        info: { flex: 1 },
        count: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        chips: { gap: 6, paddingRight: 6, alignItems: "center" },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          height: 28,
          borderRadius: 14,
          paddingLeft: 11,
          paddingRight: 7,
          backgroundColor: `${colors.primary}22`,
          borderWidth: 1,
          borderColor: `${colors.primary}55`,
        },
        chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
        edit: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          height: 34,
          borderRadius: 17,
          paddingHorizontal: 14,
          borderWidth: 1.5,
        },
        editText: { fontFamily: fonts.bold, fontSize: 13 },
      }),
    [colors]
  );

  const countLabel = narrowed
    ? t("{{shown}} of {{total}} titles", { shown, total })
    : t("{{count}} titles", { count: total });

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        {chips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((chip) => (
              <Pressable
                key={chip.key}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                onPress={() => onFilterAction(chip.action)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${chip.label}, ${t("Remove")}`}
              >
                <Text style={styles.chipText}>{chip.label}</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </Pressable>
            ))}
            <Text style={styles.count}>{countLabel}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.count}>{countLabel}</Text>
        )}
      </View>

      {onToggleEdit ? (
        <Pressable
          onPress={onToggleEdit}
          disabled={!canEdit && !editing}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: editing, disabled: !canEdit && !editing }}
          style={({ pressed }) => [
            styles.edit,
            editing
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.base200, borderColor: colors.border },
            !canEdit && !editing && { opacity: 0.4 },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name={editing ? "checkmark" : "create-outline"} size={15} color={editing ? colors.primaryContent : colors.baseContent} />
          <Text style={[styles.editText, { color: editing ? colors.primaryContent : colors.baseContent }]}>
            {editing ? t("Done") : t("Edit")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default memo(CollectionToolbar);
