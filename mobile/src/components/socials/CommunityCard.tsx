import { memo, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
// Gesture handler's Pressable: see MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Group } from "../../types";
import { fonts } from "../../theme/typography";
import { localeUpper } from "../../utils/text";
import { categoryTone } from "./communityCategory";
import CommunityTags from "./CommunityTags";

type Colors = { base200: string; baseContent: string; placeholder: string; border: string; primary: string };

export function createCommunityCardStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.base200,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 12 },
    tile: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    titleCol: { flex: 1, minWidth: 0 },
    name: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 22, color: colors.baseContent, letterSpacing: -0.2 },
    meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    category: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9 },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.placeholder, opacity: 0.7 },
    count: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
    friends: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary },
    joined: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: `${colors.primary}1F`,
    },
    joinedText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary },
    description: {
      fontFamily: fonts.regular,
      fontSize: 14.5,
      lineHeight: 21.5,
      color: colors.baseContent,
      opacity: 0.86,
      marginTop: 12,
    },
    tags: { marginTop: 13 },
  });
}

export type CommunityCardStyles = ReturnType<typeof createCommunityCardStyles>;

interface Props {
  group: Group;
  dark: boolean;
  styles: CommunityCardStyles;
  onPress: (group: Group) => void;
  /** Fired on touch-down, before the tap completes — time enough to start loading what the tap opens. */
  onPressIn?: (group: Group) => void;
}

// One community in the Communities list: what it's about, who it's for, and
// whether you're in it. For browsing only — joining and leaving happen on
// the community's own page.
function CommunityCard({ group, dark, styles, onPress, onPressIn }: Props) {
  const { t } = useTranslation();
  const tone = categoryTone(group.category, dark);
  const scale = useRef(new Animated.Value(1)).current;

  const pressTo = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: value === 1 ? 6 : 0, useNativeDriver: true }).start();

  const members = t(group.memberCount === 1 ? "{{count}} member" : "{{count}} members", { count: group.memberCount });
  const friends = group.friendsJoined ?? 0;
  const friendsLabel = friends > 0 ? t(friends === 1 ? "{{count}} friend" : "{{count}} friends", { count: friends }) : null;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={styles.card}
        onPress={() => onPress(group)}
        onPressIn={() => {
          pressTo(0.975);
          onPressIn?.(group);
        }}
        onPressOut={() => pressTo(1)}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${t(group.category)}, ${members}${friendsLabel ? `, ${friendsLabel}` : ""}${group.isMember ? `, ${t("Joined")}` : ""}`}
      >
        <View style={styles.head}>
          <View style={[styles.tile, { backgroundColor: tone.tint }]}>
            {group.coverImage ? (
              <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name={tone.icon} size={23} color={tone.color} />
            )}
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.category, { color: tone.color }]}>{localeUpper(t(group.category))}</Text>
              <View style={styles.dot} />
              <Text style={styles.count} numberOfLines={1}>
                {members}
              </Text>
              {friendsLabel ? (
                <>
                  <View style={styles.dot} />
                  <Text style={styles.friends} numberOfLines={1}>
                    {friendsLabel}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {group.isMember ? (
            <View style={styles.joined}>
              <Ionicons name="checkmark-circle" size={13} color={styles.joinedText.color} />
              <Text style={styles.joinedText}>{t("Joined")}</Text>
            </View>
          ) : null}
        </View>

        {group.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {group.description}
          </Text>
        ) : null}

        {group.tags.length > 0 ? (
          <View style={styles.tags}>
            <CommunityTags tags={group.tags} tone={tone} limit={4} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default memo(CommunityCard);
