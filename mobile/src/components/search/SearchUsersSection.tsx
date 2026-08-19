import { useCallback, useEffect, useState, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { searchUsers } from "../../api/userService";
import UserAvatar from "../UserAvatar";
import type { UserSearchResult } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  query: string;
}

// Users tab of the Search page — a plain vertical avatar+username list (no
// existing component matches this exact shape, unlike the other 4 tabs
// which all reuse an established card). Default (empty query) is a random
// sample from the backend's new $sample branch; typing switches into the
// existing regex username search, live.
export default function SearchUsersSection({ query }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { padding: 16, flexGrow: 1 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        username: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        error: { color: colors.error, textAlign: "center", marginBottom: 8 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
      }),
    [colors]
  );

  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await searchUsers(query, 1, 30);
      setUsers(items);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load users."));
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
    <FlatList
      style={{ flex: 1, backgroundColor: colors.base100 }}
      data={users}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/user/${item._id}`)}>
          <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={40} />
          <Text style={styles.username}>{item.username}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t("No results found.")}</Text>}
    />
  );
}
