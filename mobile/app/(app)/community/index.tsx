import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAllGroups, joinGroup, leaveGroup } from "../../../src/api/groupService";
import GroupCard from "../../../src/components/GroupCard";
import { SkeletonGrid, SkeletonGroupCard } from "../../../src/components/Skeleton";
import type { Group, GroupCategory } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

type Category = "all" | GroupCategory;
const CATEGORIES: Category[] = ["all", "genre", "director", "era", "style"];

export default function CommunityScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  categoryRow: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 12 },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: 13, color: colors.baseContent, textTransform: "capitalize" },
  categoryChipTextActive: { color: colors.primaryContent, fontFamily: fonts.medium },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [actionLoadingSlug, setActionLoadingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await getAllGroups();
      setGroups(items);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to load groups"));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleJoin = async (slug: string) => {
    setActionLoadingSlug(slug);
    try {
      await joinGroup(slug);
      setGroups((prev) =>
        prev.map((g) => (g.slug === slug ? { ...g, isMember: true, memberCount: g.memberCount + 1 } : g))
      );
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to join group"));
    } finally {
      setActionLoadingSlug(null);
    }
  };

  const handleLeave = async (slug: string) => {
    setActionLoadingSlug(slug);
    try {
      await leaveGroup(slug);
      setGroups((prev) =>
        prev.map((g) => (g.slug === slug ? { ...g, isMember: false, memberCount: g.memberCount - 1 } : g))
      );
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to leave group"));
    } finally {
      setActionLoadingSlug(null);
    }
  };

  const filtered = activeCategory === "all" ? groups : groups.filter((g) => g.category === activeCategory);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
              {t(cat)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.list}>
          <SkeletonGrid count={6} columns={2} renderItem={() => <SkeletonGroupCard />} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={(slug) => router.push(`/community/${slug}`)}
              onJoin={handleJoin}
              onLeave={handleLeave}
              loading={actionLoadingSlug === item.slug}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t("No groups in this category.")}</Text>}
        />
      )}
    </View>
  );
}
