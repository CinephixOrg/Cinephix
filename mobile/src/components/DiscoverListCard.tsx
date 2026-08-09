import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { DiscoverListItem } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
}

export default function DiscoverListCard({ list, onPress }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.ownerRow}>
        {list.owner.profile_pic_url ? (
          <Image source={{ uri: list.owner.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {list.owner.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.owner} numberOfLines={1}>
          {list.owner.username}
        </Text>
      </View>
      {list.fromFollowing && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("Following")}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {list.name}
      </Text>
      {list.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {list.description}
        </Text>
      ) : null}
      <Text style={styles.count}>{t("item_count", { count: list.items.length })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    marginRight: 12,
    backgroundColor: colors.base200,
    borderRadius: 12,
    padding: 12,
  },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.base300 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primary },
  owner: { fontSize: 12, color: colors.placeholder, flexShrink: 1 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  badgeText: { fontSize: 10, fontFamily: fonts.medium, color: colors.primaryContent },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginTop: 8 },
  description: { fontSize: 12, color: colors.baseContent, marginTop: 4, lineHeight: 16 },
  count: { fontSize: 11, color: colors.placeholder, marginTop: 8 },
});
