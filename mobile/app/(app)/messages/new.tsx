import { useState } from "react";
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import SearchBar from "../../../src/components/SearchBar";
import { searchUsers } from "../../../src/api/userService";
import { getOrCreateConversation } from "../../../src/api/conversationService";
import { useChat } from "../../../src/context/ChatContext";
import { SkeletonRow } from "../../../src/components/Skeleton";
import type { UserSearchResult } from "../../../src/types";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function NewMessageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshConversations } = useChat();
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const handleQuery = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const { items } = await searchUsers(query.trim());
      setResults(items);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (user: UserSearchResult) => {
    setStartingId(user._id);
    try {
      const conv = await getOrCreateConversation(user._id);
      await refreshConversations();
      router.replace({
        pathname: "/messages/[conversationId]",
        params: {
          conversationId: conv._id,
          otherUsername: user.username,
          otherAvatar: user.profile_pic_url || "",
        },
      });
    } finally {
      setStartingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <SearchBar placeholder={t("Search users...")} onChangeQuery={handleQuery} />

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleSelect(item)}
              disabled={startingId !== null}
            >
              {item.profile_pic_url ? (
                <Image source={{ uri: item.profile_pic_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {item.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.username}>{item.username}</Text>
              {startingId === item._id && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: "auto" }} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            searched ? <Text style={styles.empty}>{t("No users found.")}</Text> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  username: { fontSize: 15, color: colors.baseContent },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
});
