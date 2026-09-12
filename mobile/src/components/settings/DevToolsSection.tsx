import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { setOwnAccountTier } from "../../api/userService";
import type { AccountTier } from "../../types";

const TIERS: AccountTier[] = ["free", "plus", "premium", "dev"];

// Tier simulator, development builds only. Backed by a route that 404s when
// NODE_ENV is production, so there is nothing here to ship by accident.
function DevToolsSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState<AccountTier | null>(null);

  const current = user?.accountTier ?? "free";

  const select = useCallback(
    async (tier: AccountTier) => {
      if (tier === current || busy) return;
      setBusy(tier);
      try {
        const applied = await setOwnAccountTier(tier);
        await updateUser({ accountTier: applied });
      } catch {
        // Dev-only affordance: a failure here needs no user-facing story.
      } finally {
        setBusy(null);
      }
    },
    [current, busy, updateUser]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { padding: 15, gap: 11 },
        caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.placeholder },
        // A segmented control rather than four separate buttons: these are
        // mutually exclusive states of one value.
        segment: {
          flexDirection: "row",
          backgroundColor: colors.base100,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 3,
          gap: 3,
        },
        option: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
        optionActive: { backgroundColor: colors.primary },
        optionText: {
          fontFamily: fonts.medium,
          fontSize: 12,
          color: colors.baseContent,
          textTransform: "capitalize",
        },
        optionTextActive: { color: colors.primaryContent, fontFamily: fonts.bold },
      }),
    [colors]
  );

  return (
    <View style={styles.body}>
      <Text style={styles.caption}>
        {t("Simulate a purchase to test tier-gated features. No real billing yet.")}
      </Text>
      <View style={styles.segment}>
        {TIERS.map((tier) => {
          const active = tier === current;
          return (
            <Pressable
              key={tier}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => select(tier)}
              disabled={busy !== null}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              {busy === tier ? (
                <ActivityIndicator size="small" color={active ? colors.primaryContent : colors.baseContent} />
              ) : (
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{tier}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(DevToolsSection);
