import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { getMyActivity } from "../../../src/api/activityService";
import PersonalActivityRow from "../../../src/components/profile/PersonalActivityRow";
import type { PersonalActivityItem } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

const PAGE_LIMIT = 20;

export default function ProfileActivityScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        filterRow: { flexDirection: "row", gap: 8, padding: 16 },
        filterButton: {
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        filterText: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        filterTextActive: { color: colors.primaryContent },
        list: { paddingHorizontal: 16, paddingBottom: 24 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [range, setRange] = useState<"week" | "month">("week");
  const [items, setItems] = useState<PersonalActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (r: "week" | "month") => {
    setLoading(true);
    try {
      const res = await getMyActivity(r, 1, PAGE_LIMIT);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [range, load])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getMyActivity(range, nextPage, PAGE_LIMIT);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, range === "week" && styles.filterButtonActive]}
          onPress={() => setRange("week")}
        >
          <Text style={[styles.filterText, range === "week" && styles.filterTextActive]}>{t("This Week")}</Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, range === "month" && styles.filterButtonActive]}
          onPress={() => setRange("month")}
        >
          <Text style={[styles.filterText, range === "month" && styles.filterTextActive]}>{t("This Month")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.type}-${item.createdAt}-${i}`}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View>
              <PersonalActivityRow item={item} />
              {index < items.length - 1 && <View style={styles.divider} />}
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>{t("No activity yet.")}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}
