import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getOnlineFriends } from "../../api/userService";
import type { FeedUserRef } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const AVATAR_SIZE = 56;

// Instagram-stories-bar-style row at the very top of Paylaşımlar — only
// people you follow who currently have a live socket connection. Polled on
// mount/focus rather than pushed live (Medya isn't a real-time chat
// surface), matching this app's largely-REST architecture elsewhere.
export default function OnlineFriendsBar() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [friends, setFriends] = useState<FeedUserRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOnlineFriends()
      .then((res) => {
        // A misconfigured tunnel/proxy (e.g. a Codespaces port that isn't
        // public yet) can return an HTML/error body with a 200 status
        // instead of rejecting — guard against a non-array response so a
        // transient network hiccup can't crash the whole feed's render.
        if (!cancelled) setFriends(Array.isArray(res) ? res : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        content: { paddingHorizontal: 16, paddingVertical: 12, gap: 14, flexDirection: "row" },
        item: { alignItems: "center", width: AVATAR_SIZE + 8 },
        avatarWrap: { position: "relative" },
        avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
        onlineDot: {
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.success,
          borderWidth: 2,
          borderColor: colors.base100,
        },
        username: { fontSize: 11, color: colors.baseContent, marginTop: 4, maxWidth: AVATAR_SIZE + 8, textAlign: "center" },
        label: { fontFamily: fonts.bold, fontSize: 12, color: colors.placeholder, paddingHorizontal: 16, paddingTop: 10 },
        emptyText: { fontSize: 12.5, color: colors.placeholder, paddingHorizontal: 16, paddingBottom: 12 },
      }),
    [colors]
  );

  // Loading is the only state that hides this entirely (avoids a flash of
  // "no friends online" before the first fetch resolves) — a genuinely
  // empty result now always shows the informational empty state instead of
  // disappearing, per explicit correction to the earlier hide-when-empty
  // behavior.
  if (loading) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("Online Friends").toUpperCase()}</Text>
      {friends.length === 0 ? (
        <Text style={styles.emptyText}>{t("No friends online right now.")}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
          {friends.map((friend) => (
            <Pressable key={friend._id} style={styles.item} onPress={() => router.push(`/user/${friend._id}` as any)}>
              <View style={styles.avatarWrap}>
                {friend.profile_pic_url ? (
                  <Image source={{ uri: friend.profile_pic_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{friend.username.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.username} numberOfLines={1}>
                {friend.username}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
