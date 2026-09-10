import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import TierAvatarFrame from "./TierAvatarFrame";
import type { AccountTier } from "../types";

const CINEPHIX_LOGO = require("../../assets/cinephix_logo.png");

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
  // Opt-in, forwarded straight to the underlying Image's own `blurRadius` —
  // a real blur baked into the photo itself (RN's built-in Image feature,
  // works identically on iOS/Android, unlike a translucent BlurView overlay
  // trying to blur whatever's behind it). Omitted everywhere except
  // MatchCloudBubble.tsx's tier-locked profiles.
  blurRadius?: number;
  // The one reserved official Cinephix account gets a fixed identity here —
  // a dark, theme-coordinated gradient with the app's own logo centered —
  // regardless of whatever `profilePicUrl` its User document happens to
  // have (currently empty, which would otherwise fall through to the
  // generic initials fallback below).
  isOfficial?: boolean;
}

// Shared avatar-circle: image-or-fallback-initials, tappable to the user's
// Public Profile. Reviews is the point where inlining this per-screen (as
// network.tsx, SuggestedUserCard.tsx, user/[id].tsx, and DiscoverListCard.tsx
// each already do) stopped paying for itself — future avatar call sites
// should use this instead of inlining a 6th/7th copy.
export default function UserAvatar({ userId, username, profilePicUrl, size = 40, disabled, tier, frameBackgroundColor, blurRadius, isOfficial }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  fallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontFamily: fonts.bold, color: colors.primary },
  officialFill: { alignItems: "center", justifyContent: "center" },
}), [colors]);
  const router = useRouter();

  const content = (
    <TierAvatarFrame tier={tier} size={size} backgroundColor={frameBackgroundColor}>
      {(innerSize) =>
        isOfficial ? (
          <LinearGradient
            colors={[colors.neutral, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.officialFill, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}
          >
            <Image source={CINEPHIX_LOGO} style={{ width: innerSize * 0.58, height: innerSize * 0.58 }} resizeMode="contain" />
          </LinearGradient>
        ) : profilePicUrl ? (
          <Image
            source={{ uri: profilePicUrl }}
            style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
            blurRadius={blurRadius}
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

