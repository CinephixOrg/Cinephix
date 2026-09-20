import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, LayoutAnimation, StyleSheet, Text, View } from "react-native";
import Pressable from "../../../src/components/common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import TierAvatarFrame from "../../../src/components/TierAvatarFrame";
import { getBlockedUsers } from "../../../src/api/safetyService";
import { useSafety } from "../../../src/context/SafetyContext";
import { useToast } from "../../../src/context/ToastContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import type { FeedUserRef } from "../../../src/types";

const AVATAR = 44;

// Everyone you've blocked, with Unblock. The only way back to a blocked
// person: their profile no longer exists for you anywhere else.
export default function BlockedAccountsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { unblock } = useSafety();
  const { showToast } = useToast();
  const [people, setPeople] = useState<FeedUserRef[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getBlockedUsers()
      .then(setPeople)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        list: { padding: 12, flexGrow: 1 },
        caption: { fontSize: 13.5, lineHeight: 19, color: colors.placeholder, paddingHorizontal: 8, paddingBottom: 10 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
        name: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.baseContent },
        fallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.base200 },
        fallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
        unblock: {
          minWidth: 92,
          height: 36,
          borderRadius: 18,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        unblockText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
        state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
        stateIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          marginBottom: 6,
        },
        stateTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent },
        stateText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
        retry: { marginTop: 6, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.base200 },
        retryText: { fontFamily: fonts.bold, color: colors.baseContent },
      }),
    [colors]
  );

  const doUnblock = async (person: FeedUserRef) => {
    setBusy(person._id);
    try {
      await unblock(person._id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPeople((current) => current?.filter((p) => p._id !== person._id) ?? null);
      showToast(t("You unblocked @{{username}}", { username: person.username }));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  if (people === null) {
    return (
      <View style={[styles.screen, styles.state]}>
        {failed ? (
          <>
            <Text style={styles.stateText}>{t("Couldn't load your blocked accounts.")}</Text>
            <Pressable style={styles.retry} onPress={load}>
              <Text style={styles.retryText}>{t("Try again")}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={people}
      keyExtractor={(p) => p._id}
      ListHeaderComponent={
        people.length > 0 ? (
          <Text style={styles.caption}>{t("They can't see your profile or content, and you won't see theirs. They aren't told.")}</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <TierAvatarFrame tier={item.accountTier} size={AVATAR}>
            {(inner) =>
              item.profile_pic_url ? (
                <Image source={{ uri: item.profile_pic_url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
              ) : (
                <View style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
                  <Text style={styles.fallbackText}>{item.username.slice(0, 2).toUpperCase()}</Text>
                </View>
              )
            }
          </TierAvatarFrame>
          <Text style={styles.name} numberOfLines={1}>
            @{item.username}
          </Text>
          <Pressable
            onPress={() => doUnblock(item)}
            disabled={busy !== null}
            accessibilityRole="button"
            style={({ pressed }) => [styles.unblock, pressed && { opacity: 0.7 }]}
          >
            {busy === item._id ? <ActivityIndicator size="small" color={colors.baseContent} /> : <Text style={styles.unblockText}>{t("Unblock")}</Text>}
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.placeholder} />
          </View>
          <Text style={styles.stateTitle}>{t("No blocked accounts")}</Text>
          <Text style={styles.stateText}>{t("People you block will appear here, where you can unblock them.")}</Text>
        </View>
      }
    />
  );
}
