import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { updateOnboardingProgress } from "../src/api/userService";
import StepProgressBar from "../src/components/onboarding/StepProgressBar";
import OnboardingProfileStep from "../src/components/onboarding/OnboardingProfileStep";
import OnboardingPreferenceStep from "../src/components/onboarding/OnboardingPreferenceStep";
import OnboardingGenreStep from "../src/components/onboarding/OnboardingGenreStep";
import OnboardingFavoriteTitlesStep from "../src/components/onboarding/OnboardingFavoriteTitlesStep";
import OnboardingSuggestionGridStep from "../src/components/onboarding/OnboardingSuggestionGridStep";
import type { PickedTitle, TastePreference } from "../src/components/onboarding/onboardingTypes";

const TOTAL_STEPS = 5;

// First-run taste onboarding (TC-133) — route/entry point unchanged
// ((auth)/_layout.tsx still redirects here while needsProfileSetup is
// true), but this is now a thin wizard container instead of one flat
// screen. Progress is persisted via onboardingStep/onboardingCompletedAt
// (AuthContext's own comment on why) so a killed/backgrounded app resumes
// here rather than silently dropping the rest of the wizard.
export default function SetupProfileScreen() {
  const { colors } = useTheme();
  const { user, clearNeedsProfileSetup } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(() => {
    const resumed = user?.onboardingStep ?? 0;
    return Math.min(Math.max(resumed, 0), TOTAL_STEPS - 1);
  });
  const [preference, setPreference] = useState<TastePreference | null>(null);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [pickedTitles, setPickedTitles] = useState<PickedTitle[]>([]);

  const styles = useMemo(() => StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.base100 } }), [colors]);

  const goToStep = (next: number) => {
    setStep(next);
    updateOnboardingProgress({ step: next }).catch(() => {});
  };

  const toggleGenre = (id: number) =>
    setSelectedGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const togglePickedTitle = (title: PickedTitle) =>
    setPickedTitles((prev) =>
      prev.some((p) => p.id === title.id && p.type === title.type)
        ? prev.filter((p) => !(p.id === title.id && p.type === title.type))
        : [...prev, title]
    );

  const finish = async () => {
    try {
      await updateOnboardingProgress({ step: TOTAL_STEPS, completed: true });
    } catch {
      // A failed save here just means the wizard may show again next
      // login (same resumable-by-design behavior as any other interrupted
      // step) — never worth blocking the user from entering the app over.
    }
    await clearNeedsProfileSetup();
    router.replace("/home");
  };

  return (
    <View style={styles.screen}>
      <StepProgressBar totalSteps={TOTAL_STEPS} currentStep={step} />

      {step === 0 && <OnboardingProfileStep onNext={() => goToStep(1)} onSkip={() => goToStep(1)} />}

      {step === 1 && (
        <OnboardingPreferenceStep
          value={preference}
          onChange={setPreference}
          onNext={() => goToStep(2)}
          onSkip={() => {
            if (!preference) setPreference("both");
            goToStep(2);
          }}
        />
      )}

      {step === 2 && (
        <OnboardingGenreStep
          selectedGenreIds={selectedGenreIds}
          onToggleGenre={toggleGenre}
          onNext={() => goToStep(3)}
          onSkip={() => goToStep(3)}
        />
      )}

      {step === 3 && (
        <OnboardingFavoriteTitlesStep
          preference={preference ?? "both"}
          pickedTitles={pickedTitles}
          onTogglePick={togglePickedTitle}
          onNext={() => goToStep(4)}
          onSkip={() => goToStep(4)}
        />
      )}

      {step === 4 && (
        <OnboardingSuggestionGridStep
          preference={preference ?? "both"}
          selectedGenreIds={selectedGenreIds}
          pickedTitles={pickedTitles}
          onFinish={finish}
        />
      )}
    </View>
  );
}
