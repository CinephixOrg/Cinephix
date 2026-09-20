import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import TierAvatarFrame from "../TierAvatarFrame";
import { getUserProfile } from "../../api/userService";
import { invalidatePublicProfile } from "../../api/publicProfileCache";
import { useSafety } from "../../context/SafetyContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { readableOn } from "../../utils/color";
import type { AccountTier } from "../../types";

const AVATAR = 88;

interface BlockedPerson {
  _id: string;
  username: string;
  profile_pic_url?: string | null;
  accountTier?: AccountTier;
}

// A profile you blocked yourself: just their name and picture (the server
// sends nothing more — see backend middleware/blockFilter.js's
// blockedProfileStub) and a way to undo it. Unblocking updates the shared
// block store, so the profile screen swaps this for the full profile.
export default function BlockedProfileState({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { unblock } = useSafety();
  const { showToast } = useToast();
  const [person, setPerson] = useState<BlockedPerson | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUserProfile(userId)
      .then((p) => {
        if (cancelled) return;
        setPerson(p as unknown as BlockedPerson);
        navigation.setOptions({ title: p.username });
      })
      .catch(() => {
        // The name is a nicety; Unblock works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10, backgroundColor: colors.base100 },
        avatarWrap: { marginBottom: 8 },
        blockedAvatar: { opacity: 0.45 },
        badge: {
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.error,
          borderWidth: 3,
          borderColor: colors.base100,
        },
        fallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.base200 },
        fallbackText: { fontFamily: fonts.bold, fontSize: 26, color: colors.primary },
        username: { fontFamily: fonts.bold, fontSize: 15, color: colors.placeholder },
        title: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.baseContent, textAlign: "center" },
        text: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center", maxWidth: 320 },
        button: {
          marginTop: 14,
          minWidth: 200,
          height: 48,
          borderRadius: 24,
          paddingHorizontal: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
        buttonText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryContent },
      }),
    [colors]
  );

  const doUnblock = async () => {
    setBusy(true);
    try {
      invalidatePublicProfile(userId);
      await unblock(userId);
      if (person) showToast(t("You unblocked @{{username}}", { username: person.username }), "success");
      // No need to reset `busy`: the profile screen replaces this view.
    } catch {
      setBusy(false);
      showToast(t("Something went wrong. Please try again."));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.avatarWrap}>
        <View style={styles.blockedAvatar}>
          <TierAvatarFrame tier={person?.accountTier} size={AVATAR}>
            {(inner) =>
              person?.profile_pic_url ? (
                <Image source={{ uri: person.profile_pic_url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} blurRadius={6} />
              ) : (
                <View style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
                  <Text style={styles.fallbackText}>{person ? person.username.slice(0, 2).toUpperCase() : ""}</Text>
                </View>
              )
            }
          </TierAvatarFrame>
        </View>
        <View style={styles.badge}>
          <Ionicons name="ban" size={16} color={readableOn(colors.error)} />
        </View>
      </View>
      {person ? <Text style={styles.username}>@{person.username}</Text> : null}
      <Text style={styles.title}>{t("You blocked this user")}</Text>
      <Text style={styles.text}>{t("You won't see each other's profiles, reviews, posts or messages. Unblock to see their profile again.")}</Text>
      <Pressable
        onPress={doUnblock}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        {busy ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.buttonText}>{t("Unblock")}</Text>}
      </Pressable>
    </View>
  );
}
