import { memo, useMemo, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { fonts } from "../../theme/typography";
import {
  COMMUNITY_CATEGORIES,
  activeCommunityFilterCount,
  categoryCounts,
  type CommunityAction,
  type CommunityCategory,
  type CommunityFilters,
  type CommunityShow,
} from "../../utils/communities";
import { communitiesSnapshot, subscribeCommunities } from "../../api/communitiesStore";
import { categoryTone } from "./communityCategory";
import HeaderPopover, { PopoverLabel, PopoverReset, usePopoverStyles } from "../popover/HeaderPopover";

interface Props {
  filters: CommunityFilters;
  dispatch: (action: CommunityAction) => void;
}

// The Communities Filter menu: All / Joined, and a category, each with how
// many communities it would leave.
function CommunityFilterButton({ filters, dispatch }: Props) {
  const { t } = useTranslation();
  const { styles, colors, dark } = usePopoverStyles();
  const active = activeCommunityFilterCount(filters);
  // The communities being filtered, for the per-category counts.
  const groups = useSyncExternalStore(subscribeCommunities, communitiesSnapshot);
  const counts = useMemo(() => (groups ? categoryCounts(groups, filters.show) : null), [groups, filters.show]);

  const segment = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", marginHorizontal: 12, marginBottom: 14, padding: 3, borderRadius: 12, backgroundColor: colors.base200 },
        option: { flex: 1, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
        active: {
          backgroundColor: colors.base100,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
        text: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.placeholder },
        textActive: { fontFamily: fonts.bold, color: colors.baseContent },
      }),
    [colors]
  );

  const categoryOptions: { key: CommunityCategory; label: string }[] = [
    { key: "all", label: t("All") },
    ...COMMUNITY_CATEGORIES.map((key) => ({ key, label: t(key) })),
  ];

  return (
    <HeaderPopover icon="options-outline" label={t("Filters")} count={active}>
      <PopoverLabel text={t("Show")} styles={styles} />
      <View style={segment.row}>
        {(["all", "joined"] as CommunityShow[]).map((option) => {
          const selected = filters.show === option;
          return (
            <Pressable
              key={option}
              onPress={() => dispatch({ kind: "show", value: option })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[segment.option, selected && segment.active]}
            >
              <Text style={[segment.text, selected && segment.textActive]}>{t(option === "all" ? "All" : "Joined")}</Text>
            </Pressable>
          );
        })}
      </View>

      <PopoverLabel text={t("Category")} styles={styles} />
      {categoryOptions.map(({ key, label }) => {
        const selected = filters.category === key;
        const tone = key === "all" ? null : categoryTone(key, dark);
        return (
          <Pressable
            key={key}
            onPress={() => dispatch({ kind: "category", value: key })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <View style={[styles.optionIcon, { backgroundColor: tone ? tone.tint : colors.base200 }]}>
              <Ionicons name={tone ? tone.icon : "apps-outline"} size={15} color={tone ? tone.color : colors.baseContent} />
            </View>
            <Text style={[styles.optionText, selected && styles.optionTextActive]} numberOfLines={1}>
              {label.charAt(0).toLocaleUpperCase() + label.slice(1)}
            </Text>
            {counts ? <Text style={styles.optionCount}>{counts[key]}</Text> : null}
            <View style={styles.check}>{selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}</View>
          </Pressable>
        );
      })}

      {active > 0 ? (
        <PopoverReset label={t("Reset")} onPress={() => dispatch({ kind: "clearFilters" })} styles={styles} colors={colors} />
      ) : null}
    </HeaderPopover>
  );
}

export default memo(CommunityFilterButton);
