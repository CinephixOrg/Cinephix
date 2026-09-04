import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { setOwnAccountTier } from "../../../src/api/userService";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import type { AccountTier } from "../../../src/types";

// Sync-specific plan comparison — the rest of the app's tier gates
// (Profile Analysis schema/history/cooldown) aren't shown here, this page
// is scoped to what the user asked to level first. TIER_FRAME_STYLES
// (theme/tierFrames.ts) already carries the same blue/gold identity used
// for the avatar ring on Plus/Premium — this page's own accent colors
// below deliberately match those so a Plus card reads as the same "Plus"
// everywhere in the app.
const PLAN_ORDER: AccountTier[] = ["free", "plus", "premium"];

interface PlanFeature {
  label: string;
  included: boolean;
}

function featuresFor(tier: AccountTier, t: (k: string, opts?: any) => string): PlanFeature[] {
  if (tier === "free") {
    return [
      { label: t("1 sync search per day"), included: true },
      { label: t("Movies and series share the same daily search"), included: true },
      { label: t("Choose type & genres"), included: false },
      { label: t("Weight by watch count / avg rating"), included: false },
    ];
  }
  if (tier === "plus") {
    return [
      { label: t("3 sync searches per day"), included: true },
      { label: t("Choose type & genres"), included: true },
      { label: t("Weight by watch count / avg rating"), included: false },
      { label: t("Faster analysis cooldown"), included: true },
    ];
  }
  return [
    { label: t("15 sync searches per day"), included: true },
    { label: t("Choose type & genres"), included: true },
    { label: t("Weight by watch count / avg rating"), included: true },
    { label: t("Fastest analysis cooldown"), included: true },
  ];
}

const ACCENT: Record<AccountTier, string | null> = {
  free: null,
  plus: "#5B85B8",
  premium: "#FFC94A",
  dev: null,
};

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [busyTier, setBusyTier] = useState<AccountTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier: AccountTier = user?.accountTier ?? "free";

  const handleSelect = async (tier: AccountTier) => {
    if (tier === currentTier || busyTier) return;
    setBusyTier(tier);
    setError(null);
    try {
      const newTier = await setOwnAccountTier(tier);
      await updateUser({ accountTier: newTier });
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Couldn't update your plan. Please try again."));
    } finally {
      setBusyTier(null);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        content: { padding: 20, paddingBottom: 40, gap: 16 },
        headerTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.baseContent, textAlign: "center" },
        headerSubtitle: {
          fontSize: 13,
          color: colors.placeholder,
          textAlign: "center",
          marginTop: 6,
          marginBottom: 8,
          lineHeight: 18,
        },
        demoNotice: {
          fontSize: 11,
          fontStyle: "italic",
          color: colors.placeholder,
          textAlign: "center",
          marginBottom: 4,
        },
        errorText: { fontSize: 12.5, color: colors.error, textAlign: "center" },
        card: {
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          padding: 18,
        },
        cardCurrent: { borderColor: colors.primary },
        cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
        planName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent },
        currentBadge: {
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        currentBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.primaryContent, textTransform: "uppercase" },
        featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
        featureText: { fontSize: 13, color: colors.baseContent, flex: 1 },
        featureTextLocked: { color: colors.placeholder },
        selectButton: {
          marginTop: 16,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        selectButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.headerTitle}>{t("Sync Plans")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("Search more often, unlock filters, and fine-tune how your matches are ranked.")}
        </Text>
        <Text style={styles.demoNotice}>{t("Demo only — no real billing yet, this switches your plan instantly.")}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {PLAN_ORDER.map((tier) => {
        const isCurrent = tier === currentTier;
        const accent = ACCENT[tier];
        return (
          <View key={tier} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.planName, accent ? { color: accent } : null]}>
                {tier === "free" ? t("Free") : tier === "plus" ? t("Plus") : t("Premium")}
              </Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>{t("Current")}</Text>
                </View>
              )}
            </View>

            {featuresFor(tier, t).map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Ionicons
                  name={f.included ? "checkmark-circle" : "lock-closed"}
                  size={16}
                  color={f.included ? (accent ?? colors.success) : colors.placeholder}
                />
                <Text style={[styles.featureText, !f.included && styles.featureTextLocked]}>{f.label}</Text>
              </View>
            ))}

            {!isCurrent && (
              <Pressable
                style={[styles.selectButton, accent ? { backgroundColor: accent } : null]}
                onPress={() => handleSelect(tier)}
                disabled={busyTier !== null}
              >
                {busyTier === tier ? (
                  <ActivityIndicator color={colors.primaryContent} size="small" />
                ) : (
                  <Text style={styles.selectButtonText}>
                    {PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(currentTier) ? t("Upgrade") : t("Switch")}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
