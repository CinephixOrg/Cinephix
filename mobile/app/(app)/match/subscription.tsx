import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
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
import { localeUpper } from "../../../src/utils/text";

// The one shared subscription entry point for every tier-gated feature in
// the app (CineMatch's own locked filters/results, Medya's locked podium
// categories, Discover's locked leaderboard categories, Profile Analysis's
// schema/history/cooldown) — direct ask to list ALL of Cinephix's own
// tier leveling here, not just the Sync-specific slice this page used to
// show. Every number below is copied by hand from backend/config/tiers.js
// and the mobile-side OPEN_KEYS_BY_TIER tables in LeaderboardPodium.tsx/
// PeoplePodium.tsx — there's no shared import between the two codebases,
// same reason every other hardcoded tier number already on this page (the
// old featuresFor's own "15 sync searches per day" etc.) was hardcoded
// too. If those source-of-truth numbers ever change, this page's own
// copy needs a matching manual update — not new to this rewrite, just
// now covering more ground than it used to.
const PLAN_ORDER: AccountTier[] = ["free", "plus", "premium"];

interface FeatureSection {
  heading: string;
  items: string[];
}

function sectionsFor(tier: AccountTier, t: (k: string, opts?: any) => string): FeatureSection[] {
  if (tier === "free") {
    return [
      { heading: t("Sync"), items: [t("1 sync search per day")] },
      { heading: t("Sync Results"), items: [t("Your #1 match stays locked — see the other 4")] },
      {
        heading: t("Sync Analysis"),
        items: [
          t("View analysis with a {{minutes}}-minute cooldown per person", { minutes: 60 }),
          t("Sync analysis from a profile: locked"),
        ],
      },
      { heading: t("Profile Analysis"), items: [t("Basic analysis, once a day")] },
      {
        heading: t("Leaderboards"),
        items: [
          t("{{count}} of {{total}} leaderboard categories unlocked", { count: 1, total: 5 }),
          t("{{count}} of {{total}} leaderboard categories unlocked", { count: 1, total: 6 }),
        ],
      },
    ];
  }
  if (tier === "plus") {
    return [
      { heading: t("Sync"), items: [t("3 sync searches per day"), t("Choose type & genre filters")] },
      { heading: t("Sync Results"), items: [t("Your top 3 matches fully unlocked")] },
      {
        heading: t("Sync Analysis"),
        items: [
          t("View analysis with a {{minutes}}-minute cooldown per person", { minutes: 15 }),
          t("5 sync analyses per week from profiles"),
        ],
      },
      { heading: t("Profile Analysis"), items: [t("Richer analysis with history, every 6 hours")] },
      {
        heading: t("Leaderboards"),
        items: [
          t("{{count}} of {{total}} leaderboard categories unlocked", { count: 3, total: 5 }),
          t("{{count}} of {{total}} leaderboard categories unlocked", { count: 3, total: 6 }),
        ],
      },
    ];
  }
  return [
    {
      heading: t("Sync"),
      items: [t("15 sync searches per day"), t("Choose type & genre filters"), t("Weight matches by watch count or average rating")],
    },
    { heading: t("Sync Results"), items: [t("All 5 matches fully unlocked")] },
    {
      heading: t("Sync Analysis"),
      items: [
        t("View analysis with a {{minutes}}-minute cooldown per person", { minutes: 5 }),
        t("Unlimited sync analyses from profiles"),
      ],
    },
    { heading: t("Profile Analysis"), items: [t("Richer analysis with history and advanced cards, every hour")] },
    { heading: t("Leaderboards"), items: [t("All leaderboard categories unlocked")] },
  ];
}

// Single source of truth for Plus/Premium's own color identity — same
// silver/gold pair the avatar ring and post-card gradient name already use
// (theme/tierFrames.ts), instead of this page's own separate hardcoded
// hex pair. `glowColor` doubles as a flat representative tone for the
// section headings (those don't need a full gradient).
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
        // Every plan stacked in one column now, full width — direct ask
        // ("free ile plus yan yana olmasın, alt alta dizilsin"): each
        // card's own feature list grew from a flat 4-line list to 5
        // grouped sections once this page started covering every tier-
        // gated feature in the app, not just Sync's own 4 — two cards
        // side by side at half width would have made that content
        // cramped/scroll-within-a-card, which a single stacked column
        // avoids entirely.
        planStack: { gap: 14 },
        cardBase: { borderRadius: 16, backgroundColor: colors.base200, padding: 18 },
        cardFlatBorder: { borderWidth: 1.5, borderColor: colors.border },
        cardCurrent: { borderColor: colors.primary },
        // The metallic-frame treatment for Plus/Premium — same silver/gold
        // gradient pair as the avatar ring and post-card name. RN has no
        // gradient borderColor, so this is the standard "gradient
        // background behind an inset content view" trick: the outer
        // LinearGradient's own 2px padding is what actually reads as the
        // border.
        cardGradientWrap: { borderRadius: 16, padding: 2 },
        cardGradientInner: { borderRadius: 14 },
        cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
        planName: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.baseContent },
        currentBadge: {
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        currentBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.primaryContent },
        sectionBlock: { marginTop: 14 },
        sectionHeading: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.4, marginBottom: 6 },
        featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
        featureText: { fontSize: 13.5, color: colors.baseContent, flex: 1, lineHeight: 18 },
        selectButton: {
          marginTop: 18,
          borderRadius: 10,
          paddingVertical: 13,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        // Plus/Premium's own select button fills with the same metallic
        // gradient instead of a flat accent color.
        selectButtonGradient: {
          marginTop: 18,
          borderRadius: 10,
          paddingVertical: 13,
          alignItems: "center",
        },
        selectButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
        // Premium's gold and Plus's silver are both light/near-white at one
        // end of their gradient — the default primaryContent label color
        // could wash out against that. Dark, fixed, both tiers.
        selectButtonGradientText: { fontFamily: fonts.bold, fontSize: 14, color: "#1A1A1A" },
      }),
    [colors]
  );

  const renderCard = (tier: AccountTier) => {
    const isCurrent = tier === currentTier;
    const accent = accentFor(tier);
    const gradient = gradientFor(tier);

    const body = (
      <>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.planName, accent ? { color: accent } : null]}>
            {tier === "free" ? t("Free") : tier === "plus" ? t("Plus") : t("Premium")}
          </Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>{localeUpper(t("Current"))}</Text>
            </View>
          )}
        </View>

        {sectionsFor(tier, t).map((section) => (
          <View key={section.heading} style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: accent ?? colors.placeholder }]}>{localeUpper(section.heading)}</Text>
            {section.items.map((item) => (
              <View key={item} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color={accent ?? colors.success} style={{ marginTop: 1 }} />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
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

    if (gradient) {
      return (
        <View key={tier}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradientWrap}>
            <View style={[styles.cardBase, styles.cardGradientInner]}>{body}</View>
          </LinearGradient>
        </View>
      );
    }
    return (
      <View key={tier} style={[styles.cardBase, styles.cardFlatBorder, isCurrent && styles.cardCurrent]}>
        {body}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.headerTitle}>{t("Subscription Plans")}</Text>
        <Text style={styles.headerSubtitle}>{t("See what's included at every level, and upgrade any time.")}</Text>
        <Text style={styles.demoNotice}>{t("Demo only — no real billing yet, this switches your plan instantly.")}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.planStack}>{PLAN_ORDER.map((tier) => renderCard(tier))}</View>
    </ScrollView>
  );
}
