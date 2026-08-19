import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import UserAvatar from "./UserAvatar";
import type { FeedUserRef } from "../types";
import { useTheme } from "../context/ThemeContext";

interface Props {
  users: FeedUserRef[];
  size?: number;
  max?: number;
}

// Extracted from TopPickCard's original inline pattern — plain Views with a
// negative-margin overlap and a background-colored border for the cutout
// ring, no SVG involved. Avatars are non-interactive (disabled) since
// they're a compact "who did this" indicator, not a tap target list.
export default function StackedAvatars({ users, size = 24, max = 3 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center" },
        avatar: { marginLeft: -8, borderWidth: 2, borderColor: colors.base100, borderRadius: size / 2 + 2 },
      }),
    [colors, size]
  );

  return (
    <View style={styles.row}>
      {users.slice(0, max).map((user, i) => (
        <View key={user._id} style={[styles.avatar, i === 0 && { marginLeft: 0 }]}>
          <UserAvatar userId={user._id} username={user.username} profilePicUrl={user.profile_pic_url} size={size} disabled />
        </View>
      ))}
    </View>
  );
}
