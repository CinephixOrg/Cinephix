import { useCallback, useEffect, useState, useMemo } from "react";
import { ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularLists } from "../../api/listService";
import DiscoverListCard from "../DiscoverListCard";
import type { DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  query: string;
}

// Lists tab of the Search page — same popularity-sorted default and card
// design as Home's Popular Lists section (DiscoverListCard), now also
// name-searchable via the new `q` param on getPopularLists.
export default function SearchListsSection({ query }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { padding: 16, flexGrow: 1 },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [lists, setLists] = useState<DiscoverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getPopularLists(30, query || undefined);
      setLists(result);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load lists."));
    }
  }, [query]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.base100 }} color={colors.primary} />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {lists.length === 0 ? (
        <Text style={styles.empty}>{t("No results found.")}</Text>
      ) : (
        lists.map((list) => (
          <DiscoverListCard
            key={list._id}
            list={list}
            onPress={() => router.push(`/search/lists/${list._id}`)}
            basePath="/search"
          />
        ))
      )}
    </ScrollView>
  );
}
