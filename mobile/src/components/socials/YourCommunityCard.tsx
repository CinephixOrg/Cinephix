import { memo, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
// Gesture handler's Pressable: see MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Group } from "../../types";
import { fonts } from "../../theme/typography";

type Colors = { base200: string; base300: string; baseContent: string; placeholder: string; base100: string };

export function createYourCommunityCardStyles(colors: Colors) {
  return StyleSheet.create({
    card: { borderRadius: 20, marginBottom: 16, overflow: "hidden" },
    inner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.base200, borderRadius: 19, margin: 2, padding: 14 },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
    eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
    eyebrow: { fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 1 },
    tile: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.base300, overflow: "hidden" },
    titleCol: { flex: 1, minWidth: 0 },
    name: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 22, color: colors.baseContent, letterSpacing: -0.2 },
    count: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, marginTop: 2 },
    chevronTile: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.base300 },
  });
}

export type YourCommunityCardStyles = ReturnType<typeof createYourCommunityCardStyles>;

interface Props {
  group: Group;
  styles: YourCommunityCardStyles;
  onPress: (group: Group) => void;
}

// A standalone, visually distinct entry pinned above the regular Communities
// list — direct ask, after the only way to reach your own community was the
// same browse/filter flow as any other one ("çok saçma" per the admin).
// Derived client-side from the already-fetched groups list (owner is
// populated server-side), so no new endpoint or filter tab is needed.
function YourCommunityCard({ group, styles, onPress }: Props) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(1)).current;
  const accent = group.accentColor || "#6C5CE7";

  const pressTo = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: value === 1 ? 6 : 0, useNativeDriver: true }).start();

  const members = t(group.memberCount === 1 ? "{{count}} member" : "{{count}} members", { count: group.memberCount });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.card, { backgroundColor: accent }]}
        onPress={() => onPress(group)}
        onPressIn={() => pressTo(0.975)}
        onPressOut={() => pressTo(1)}
        accessibilityRole="button"
        accessibilityLabel={`${t("Your Community")}: ${group.name}, ${members}`}
      >
        <View style={styles.inner}>
          <View style={styles.tile}>
            {group.coverImage ? (
              <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name="shield-checkmark" size={22} color={accent} />
            )}
          </View>
          <View style={styles.titleCol}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowDot, { backgroundColor: accent }]} />
              <Text style={[styles.eyebrow, { color: accent }]}>{t("YOUR COMMUNITY")}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.count} numberOfLines={1}>
              {members}
            </Text>
          </View>
          <View style={styles.chevronTile}>
            <Ionicons name="chevron-forward" size={16} color={styles.name.color} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(YourCommunityCard);
