import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getNewUsers } from "../../api/userService";
import UserAvatar from "../UserAvatar";
import type { UserSearchResult } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Fills Search's Users tab empty state (no query — direct ask, same idea
// as the other 4 tabs' own empty-state sections) with recently-joined
// accounts (userController.js's getNewUsers, sorted by signup date). No
// client-side sampling here, unlike the other sections — newest-first is
// the point of a "new users" list, so showing the literal latest signups
// (not a random few) is the correct behavior, not a shortcut.
export default function NewUsersSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [users, setUsers] = useState<UserSearchResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNewUsers(8)
      .then((res) => {
        if (!cancelled) setUsers(res);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", paddingTop: 16 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 4, paddingHorizontal: 16 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
        username: { fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
      }),
    [colors]
  );

  if (!users || users.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("New Users")}</Text>
      {users.map((item) => (
        <Pressable key={item._id} style={styles.row} onPress={() => router.push(`/user/${item._id}`)}>
          <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={40} tier={item.accountTier} />
          <Text style={styles.username}>{item.username}</Text>
        </Pressable>
      ))}
    </View>
  );
}
