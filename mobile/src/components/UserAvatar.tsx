import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  userId: string;
  username: string;
  profilePicUrl?: string;
  size?: number;
  // Renders without the Pressable/navigation wrapper — rare, default false.
  disabled?: boolean;
}

// Shared avatar-circle: image-or-fallback-initials, tappable to the user's
// Public Profile. Reviews is the point where inlining this per-screen (as
// network.tsx, SuggestedUserCard.tsx, user/[id].tsx, and DiscoverListCard.tsx
// each already do) stopped paying for itself — future avatar call sites
// should use this instead of inlining a 6th/7th copy.
export default function UserAvatar({ userId, username, profilePicUrl, size = 40, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  fallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontFamily: fonts.bold, color: colors.primary },
}), [colors]);
  const router = useRouter();

  const content = profilePicUrl ? (
    <Image
      source={{ uri: profilePicUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.32 }]}>
        {username.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );

  if (disabled) return content;

  return (
    <Pressable onPress={() => router.push(`/user/${userId}`)} hitSlop={4}>
      {content}
    </Pressable>
  );
}

