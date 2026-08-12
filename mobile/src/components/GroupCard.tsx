import { useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Group } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";

interface Props {
  group: Group;
  onPress: (slug: string) => void;
  onJoin: (slug: string) => void;
  onLeave: (slug: string) => void;
  loading: boolean;
}

function categoryColor(colors: ColorPalette): Record<Group["category"], string> {
  return {
    director: colors.primary,
    genre: colors.secondary,
    era: colors.accent,
    style: colors.info,
  };
}

export default function GroupCard({ group, onPress, onJoin, onLeave, loading }: Props) {
  const { colors } = useTheme();
  const CATEGORY_COLOR = useMemo(() => categoryColor(colors), [colors]);
  const styles = useMemo(() => StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: fonts.medium, color: colors.primaryContent, textTransform: "capitalize" },
  memberCount: { flexDirection: "row", alignItems: "center", gap: 3 },
  memberCountText: { fontSize: 11, color: colors.placeholder },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent, marginTop: 8 },
  description: { fontSize: 12, color: colors.placeholder, marginTop: 4, lineHeight: 17 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  tagChip: { backgroundColor: colors.base300, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, color: colors.placeholder },
  actionButton: { marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  joinButton: { backgroundColor: colors.primary },
  joinButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 13 },
  leaveButton: { borderWidth: 1, borderColor: colors.error },
  leaveButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 13 },
}), [colors]);
  const { t } = useTranslation();
  return (
    <Pressable style={styles.card} onPress={() => onPress(group.slug)}>
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: CATEGORY_COLOR[group.category] }]}>
          <Text style={styles.badgeText}>{t(group.category)}</Text>
        </View>
        <View style={styles.memberCount}>
          <Ionicons name="people-outline" size={13} color={colors.placeholder} />
          <Text style={styles.memberCountText}>{group.memberCount}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {group.name}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {group.description}
      </Text>

      {group.tags.length > 0 && (
        <View style={styles.tagRow}>
          {group.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.actionButton, group.isMember ? styles.leaveButton : styles.joinButton]}
        onPress={() => (group.isMember ? onLeave(group.slug) : onJoin(group.slug))}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={group.isMember ? colors.error : colors.primaryContent} />
        ) : (
          <Text style={group.isMember ? styles.leaveButtonText : styles.joinButtonText}>
            {group.isMember ? t("Leave") : t("Join")}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

