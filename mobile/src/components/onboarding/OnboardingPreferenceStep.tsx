import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { TastePreference } from "./onboardingTypes";

interface Props {
  value: TastePreference | null;
  onChange: (value: TastePreference) => void;
  onNext: () => void;
  onSkip: () => void;
}

const OPTIONS: { value: TastePreference; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { value: "movies", icon: "film-outline", label: "Mostly movies" },
  { value: "series", icon: "tv-outline", label: "Mostly series" },
  { value: "both", icon: "albums-outline", label: "Both equally" },
];

// Step 2 — single-choice, skippable (skip ⇒ treated as "both" by the
// wizard container, which decides which genre taxonomy/catalog queries
// Steps 3-5 use based on this answer).
export default function OnboardingPreferenceStep({ value, onChange, onNext, onSkip }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { padding: 20, flexGrow: 1, justifyContent: "center" },
        title: { fontSize: 24, fontFamily: fonts.bold, textAlign: "center", color: colors.primary },
        subtitle: { textAlign: "center", color: colors.placeholder, marginTop: 6, marginBottom: 28 },
        card: {
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          borderRadius: 14,
          padding: 18,
          marginBottom: 14,
        },
        cardActive: { borderColor: colors.primary, backgroundColor: colors.base100 },
        cardText: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 20 },
        buttonDisabled: { opacity: 0.5 },
        buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
        skipText: { textAlign: "center", marginTop: 16, color: colors.placeholder, fontFamily: fonts.medium },
      }),
    [colors]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t("What do you watch more?")}</Text>
      <Text style={styles.subtitle}>{t("This helps us suggest the right titles.")}</Text>

      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable key={opt.value} style={[styles.card, active && styles.cardActive]} onPress={() => onChange(opt.value)}>
            <Ionicons name={opt.icon} size={26} color={active ? colors.primary : colors.placeholder} />
            <Text style={styles.cardText}>{t(opt.label)}</Text>
            {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginLeft: "auto" }} /> : null}
          </Pressable>
        );
      })}

      <Pressable style={[styles.button, !value && styles.buttonDisabled]} onPress={onNext} disabled={!value}>
        <Text style={styles.buttonText}>{t("Next")}</Text>
      </Pressable>

      <Pressable onPress={onSkip}>
        <Text style={styles.skipText}>{t("Skip for now")}</Text>
      </Pressable>
    </ScrollView>
  );
}
