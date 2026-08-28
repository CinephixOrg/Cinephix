import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getAllGroups, joinGroup, leaveGroup } from "../../api/groupService";
import GroupCard from "../GroupCard";
import { SkeletonGrid, SkeletonGroupCard } from "../Skeleton";
import CommunityFiltersModal, { type CommunityFilters } from "./CommunityFiltersModal";
import type { Group } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const DEFAULT_FILTERS: CommunityFilters = { innerTab: "all", category: "all" };

export default function CommunitiesSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  // Same plain-icon actionButton look as MessagesSection's recommend/new-
  // message buttons (no border, no pill, no label) — was a bordered pill
  // with a text label before, which was the odd one out visually.
  filterTriggerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: { padding: 4 },
  filterDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<CommunityFilters>(DEFAULT_FILTERS);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [actionLoadingSlug, setActionLoadingSlug] = useState<string | null>(null);
  const { innerTab, category: activeCategory } = filters;
  const hasActiveFilters = innerTab !== "all" || activeCategory !== "all";

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
      <View style={styles.filterTriggerRow}>
        <Pressable onPress={() => setFiltersModalVisible(true)} hitSlop={8} style={styles.filterButton}>
          <Ionicons name="options-outline" size={22} color={colors.baseContent} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </Pressable>
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

      <CommunityFiltersModal
        visible={filtersModalVisible}
        onClose={() => setFiltersModalVisible(false)}
        filters={filters}
        onApply={setFilters}
      />
    </View>
  );
}
