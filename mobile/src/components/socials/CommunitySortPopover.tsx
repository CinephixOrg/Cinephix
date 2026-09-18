import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { sortDirection, sortPriority, type CommunityAction, type CommunityFilters, type CommunitySortKey } from "../../utils/communities";
import HeaderPopover, { PopoverLabel, PopoverReset, usePopoverStyles } from "./HeaderPopover";

interface Props {
  filters: CommunityFilters;
  dispatch: (action: CommunityAction) => void;
}

const OPTIONS: { key: CommunitySortKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "members", icon: "people-outline" },
  { key: "friends", icon: "heart-outline" },
  { key: "name", icon: "text-outline" },
];

// The Communities Sort menu — the Filter menu's design, with the Watched
// List's sort rules: several sorts can be on at once, the first picked leads
// and the rest break its ties, so each active one shows its place in that
// order. Name reads A-Z, then Z-A on a second tap, then off.
function CommunitySortButton({ filters, dispatch }: Props) {
  const { t } = useTranslation();
  const { styles, colors } = usePopoverStyles();
  const active = filters.sorts.length;

  const labelFor = (key: CommunitySortKey) => {
    if (key === "members") return t("Most Members");
    if (key === "friends") return t("Friends Joined");
    return sortDirection(filters, "name") === "desc" ? t("Name (Z-A)") : t("Name (A-Z)");
  };

  return (
    <HeaderPopover icon="swap-vertical-outline" label={t("Sort by")} count={active}>
      <PopoverLabel text={t("Sort by")} styles={styles} />
      {OPTIONS.map(({ key, icon }) => {
        const priority = sortPriority(filters, key);
        const selected = priority > 0;
        return (
          <Pressable
            key={key}
            onPress={() => dispatch({ kind: "sort", key })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <View style={[styles.optionIcon, { backgroundColor: selected ? `${colors.primary}22` : colors.base200 }]}>
              <Ionicons name={icon} size={15} color={selected ? colors.primary : colors.baseContent} />
            </View>
            <Text style={[styles.optionText, selected && styles.optionTextActive]} numberOfLines={1}>
              {labelFor(key)}
            </Text>
            {/* With more than one sort on, each shows its place in the order. */}
            {selected && active > 1 ? (
              <View style={styles.priority}>
                <Text style={styles.priorityText}>{priority}</Text>
              </View>
            ) : (
              <View style={styles.check}>{selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}</View>
            )}
          </Pressable>
        );
      })}

      {active > 1 ? <Text style={styles.hint}>{t("The first sort leads; the others break its ties.")}</Text> : null}

      {active > 0 ? (
        <PopoverReset label={t("Clear sort")} onPress={() => dispatch({ kind: "clearSorts" })} styles={styles} colors={colors} />
      ) : null}
    </HeaderPopover>
  );
}

export default memo(CommunitySortButton);
