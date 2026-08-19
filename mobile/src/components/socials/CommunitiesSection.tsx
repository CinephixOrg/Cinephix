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
import { getAllGroups, joinGroup, leaveGroup } from "../../api/groupService";
import GroupCard from "../GroupCard";
import { SkeletonGrid, SkeletonGroupCard } from "../Skeleton";
import type { Group, GroupCategory } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type Category = "all" | GroupCategory;
const CATEGORIES: Category[] = ["all", "genre", "director", "era", "style"];
type InnerTab = "all" | "mine";

export default function CommunitiesSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.base200,
    borderRadius: 20,
    padding: 3,
  },
  segmentButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 17 },
  segmentButtonActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
  segmentTextActive: { color: colors.primaryContent, fontFamily: fonts.bold },
  divider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: colors.border, marginHorizontal: 12 },
  categoryScroll: { flex: 1 },
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
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [innerTab, setInnerTab] = useState<InnerTab>("all");
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

  const filtered = groups.filter(
    (g) => (innerTab === "all" || g.isMember) && (activeCategory === "all" || g.category === activeCategory)
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segmentButton, innerTab === "all" && styles.segmentButtonActive]}
            onPress={() => setInnerTab("all")}
          >
            <Text style={[styles.segmentText, innerTab === "all" && styles.segmentTextActive]}>{t("All")}</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, innerTab === "mine" && styles.segmentButtonActive]}
            onPress={() => setInnerTab("mine")}
          >
            <Text style={[styles.segmentText, innerTab === "mine" && styles.segmentTextActive]}>{t("Mine")}</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
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
      </View>

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
              onPress={(slug) => router.push(`/socials/communities/${slug}`)}
              onJoin={handleJoin}
              onLeave={handleLeave}
              loading={actionLoadingSlug === item.slug}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {t(innerTab === "mine" ? "You haven't joined any communities yet." : "No groups in this category.")}
            </Text>
          }
        />
      )}
    </View>
  );
}
