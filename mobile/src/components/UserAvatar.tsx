import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import TierAvatarFrame from "./TierAvatarFrame";
import type { AccountTier } from "../types";

interface Props {
  userId: string;
  username: string;
  profilePicUrl?: string;
  size?: number;
  // Renders without the Pressable/navigation wrapper — rare, default false.
  disabled?: boolean;
  // Opt-in, Socials/Profile-tab call sites only — omitting it (the
  // default at every existing call site) renders exactly as before, so
  // this is safe to add without touching screens outside that scope.
  tier?: AccountTier | null;
  // Passed through to TierAvatarFrame — set this when the avatar sits on a
  // card/tile whose background isn't the screen's own (see that prop's doc
  // there for why it matters).
  frameBackgroundColor?: string;
}

// Shared avatar-circle: image-or-fallback-initials, tappable to the user's
// Public Profile. Reviews is the point where inlining this per-screen (as
// network.tsx, SuggestedUserCard.tsx, user/[id].tsx, and DiscoverListCard.tsx
// each already do) stopped paying for itself — future avatar call sites
// should use this instead of inlining a 6th/7th copy.
export default function UserAvatar({ userId, username, profilePicUrl, size = 40, disabled, tier, frameBackgroundColor }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  fallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontFamily: fonts.bold, color: colors.primary },
}), [colors]);
  const router = useRouter();

  const content = (
    <TierAvatarFrame tier={tier} size={size} backgroundColor={frameBackgroundColor}>
      {(innerSize) =>
        profilePicUrl ? (
          <Image
            source={{ uri: profilePicUrl }}
            style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
          />
        ) : (
          <View style={[styles.fallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
            <Text style={[styles.fallbackText, { fontSize: innerSize * 0.32 }]}>
              {(username || "?").slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )
      }
    </TierAvatarFrame>
  );

  if (disabled) return content;

  return (
    <Pressable onPress={() => router.push(`/user/${userId}`)} hitSlop={4}>
      {content}
    </Pressable>
  );
}

