import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { setOwnAccountTier } from "../../../src/api/userService";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import { TIER_FRAME_STYLES } from "../../../src/theme/tierFrames";
import type { AccountTier } from "../../../src/types";

// Sync-specific plan comparison — the rest of the app's tier gates
// (Profile Analysis schema/history/cooldown) aren't shown here, this page
// is scoped to what the user asked to level first. TIER_FRAME_STYLES
// (theme/tierFrames.ts) already carries the same silver/gold identity used
// for the avatar ring on Plus/Premium — this page's own accent colors
// below deliberately match those so a Plus card reads as the same "Plus"
// everywhere in the app. Also now the one shared subscription entry point
// for Medya/Shares' own locked podium (PeoplePodium.tsx) — still Sync-
// flavored copy below, reused as-is per scope (not asked to generalize it).
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

// Single source of truth for Plus/Premium's own color identity — same
// silver/gold pair the avatar ring and post-card gradient name already use
// (theme/tierFrames.ts), instead of this page's own separate hardcoded
// hex pair. `glowColor` doubles as a flat representative tone for the
// checkmark icons/plan name (those don't need a full gradient).
const accentFor = (tier: AccountTier): string | null => (tier === "free" ? null : TIER_FRAME_STYLES[tier]?.glowColor ?? null);
const gradientFor = (tier: AccountTier): [string, string] | null => (tier === "free" ? null : TIER_FRAME_STYLES[tier]?.gradient ?? null);

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
        // Free/Plus share one row, 50/50 (flex:1 each) — default
        // alignItems:"stretch" on a row's cross axis is what makes both
        // cards start and end at the same height regardless of which one's
        // content happens to be taller, no extra height math needed.
        planRow: { flexDirection: "row", gap: 12 },
        cardHalf: { flex: 1 },
        // Shared visual content (background/padding/radius) for every card,
        // independent of how its border/frame is drawn — Free gets a plain
        // flat border straight on this, Plus/Premium wrap it inside a
        // gradient frame instead (cardGradientWrap/cardGradientInner below).
        cardBase: { borderRadius: 16, backgroundColor: colors.base200, padding: 18 },
        cardFlatBorder: { borderWidth: 1.5, borderColor: colors.border },
        cardCurrent: { borderColor: colors.primary },
        // The metallic-frame treatment for Plus/Premium — same silver/gold
        // gradient pair as the avatar ring and post-card name, direct ask
        // ("çerçevelerini de... metalik dolgu ile yap"). RN has no gradient
        // borderColor, so this is the standard "gradient background behind
        // an inset content view" trick: the outer LinearGradient's own
        // 2px padding is what actually reads as the border.
        cardGradientWrap: { borderRadius: 16, padding: 2 },
        cardGradientInner: { borderRadius: 14 },
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
        // Plus/Premium's own select button fills with the same metallic
        // gradient instead of a flat accent color — the gradient View
        // itself carries the shape/padding here since it's the outermost
        // element in that case (see selectButtonGradientText below for why
        // the label needs its own color override).
        selectButtonGradient: {
          marginTop: 16,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
        },
        selectButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
        // Premium's gold and Plus's silver are both light/near-white at one
        // end of their gradient — the default primaryContent label color
        // (usually a light color meant for a solid colors.primary
        // background) could wash out against that. Dark, fixed, both tiers.
        selectButtonGradientText: { fontFamily: fonts.bold, fontSize: 14, color: "#1A1A1A" },
      }),
    [colors]
  );

  const renderCardBody = (tier: AccountTier) => {
    const isCurrent = tier === currentTier;
    const accent = accentFor(tier);
    const gradient = gradientFor(tier);
    return (
      <>
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

        {!isCurrent &&
          (gradient ? (
            <Pressable onPress={() => handleSelect(tier)} disabled={busyTier !== null}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.selectButtonGradient}>
                {busyTier === tier ? (
                  <ActivityIndicator color="#1A1A1A" size="small" />
                ) : (
                  <Text style={styles.selectButtonGradientText}>
                    {PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(currentTier) ? t("Upgrade") : t("Switch")}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable style={styles.selectButton} onPress={() => handleSelect(tier)} disabled={busyTier !== null}>
              {busyTier === tier ? (
                <ActivityIndicator color={colors.primaryContent} size="small" />
              ) : (
                <Text style={styles.selectButtonText}>
                  {PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(currentTier) ? t("Upgrade") : t("Switch")}
                </Text>
              )}
            </Pressable>
          ))}
      </>
    );
  };

  const renderCard = (tier: AccountTier, containerStyle?: StyleProp<ViewStyle>) => {
    const isCurrent = tier === currentTier;
    const gradient = gradientFor(tier);
    if (gradient) {
      return (
        <View key={tier} style={containerStyle}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradientWrap}>
            <View style={[styles.cardBase, styles.cardGradientInner]}>{renderCardBody(tier)}</View>
          </LinearGradient>
        </View>
      );
    }
    return (
      <View key={tier} style={[styles.cardBase, styles.cardFlatBorder, isCurrent && styles.cardCurrent, containerStyle]}>
        {renderCardBody(tier)}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.headerTitle}>{t("Subscription Plans")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("Search more often, unlock filters, and fine-tune how your matches are ranked.")}
        </Text>
        <Text style={styles.demoNotice}>{t("Demo only — no real billing yet, this switches your plan instantly.")}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Free/Plus side by side (50/50, same start/end via the row's own
          default stretch), Premium — the most-featured plan — spans the
          full width below instead of competing for half a row, with the
          content container's own `gap` (not a touching/adjacent layout)
          keeping it separated from the row above. */}
      <View style={styles.planRow}>
        {renderCard("free", styles.cardHalf)}
        {renderCard("plus", styles.cardHalf)}
      </View>
      {renderCard("premium")}
    </ScrollView>
  );
}
