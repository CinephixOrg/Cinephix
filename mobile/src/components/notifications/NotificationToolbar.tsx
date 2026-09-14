import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { FeedFilter } from "../../api/notificationFeedStore";

interface Props {
  filter: FeedFilter;
  onChangeFilter: (filter: FeedFilter) => void;
  unreadCount: number;
  canClear: boolean;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

// All / Unread on the left; Mark all read and Clear all as icon buttons on
// the right. Both buttons stay in place and dim when there's nothing for
// them to do, so the row never reflows as the list changes.
function NotificationToolbar({ filter, onChangeFilter, unreadCount, canClear, onMarkAllRead, onClearAll }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const canMarkAllRead = unreadCount > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
        segment: {
          flexDirection: "row",
          height: 40,
          padding: 3,
          gap: 3,
          borderRadius: 12,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        option: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 9 },
        optionActive: { backgroundColor: colors.primary },
        optionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        optionTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
        count: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 5,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
        countActive: { backgroundColor: colors.primaryContent },
        countText: { fontFamily: fonts.bold, fontSize: 10, color: colors.primaryContent },
        countTextActive: { color: colors.primary },
        spacer: { flex: 1 },
        iconButton: {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        disabled: { opacity: 0.4 },
        pressed: { transform: [{ scale: 0.94 }] },
      }),
    [colors]
  );

  const renderOption = (value: FeedFilter, label: string, badge?: number) => {
    const active = filter === value;
    return (
      <Pressable
        onPress={() => onChangeFilter(value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={[styles.option, active && styles.optionActive]}
      >
        <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
        {badge ? (
          <View style={[styles.count, active && styles.countActive]}>
            <Text style={[styles.countText, active && styles.countTextActive]}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.segment} accessibilityRole="tablist">
        {renderOption("all", t("All"))}
        {renderOption("unread", t("Unread"), unreadCount)}
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={onMarkAllRead}
        disabled={!canMarkAllRead}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t("Mark all read")}
        accessibilityState={{ disabled: !canMarkAllRead }}
        style={({ pressed }) => [styles.iconButton, !canMarkAllRead && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="checkmark-done" size={20} color={canMarkAllRead ? colors.primary : colors.placeholder} />
      </Pressable>
      <Pressable
        onPress={onClearAll}
        disabled={!canClear}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t("Clear all")}
        accessibilityState={{ disabled: !canClear }}
        style={({ pressed }) => [styles.iconButton, !canClear && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={19} color={canClear ? colors.error : colors.placeholder} />
      </Pressable>
    </View>
  );
}

export default memo(NotificationToolbar);
