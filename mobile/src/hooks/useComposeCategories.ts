import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ComposeCategory } from "../components/home/PostComposeMenu";
import { useComposeTutorial } from "../context/ComposeTutorialContext";

/**
 * The "+" compose-hub menu's 6 categories — a pure navigate+toast
 * dispatcher per direct spec, never a real composer (see
 * PostComposeMenu.tsx's own doc comment). Each one starts its own
 * ComposeTutorialContext walkthrough and lands the user on an existing
 * screen. Pulled out of SharesFeedSection.tsx (the Shares feed's own "+"
 * button) so Profile's own "+" button — direct ask, same entry point
 * should exist there too — can open the identical menu without
 * duplicating this list.
 */
export function useComposeCategories(onPick?: () => void): ComposeCategory[] {
  const { t } = useTranslation();
  const router = useRouter();
  const { startRecommendTutorial, startReviewTutorial, startAnalyzeTutorial, startPollTutorial, startBadgeTutorial, startListTutorial } =
    useComposeTutorial();

  return useMemo(
    () => [
      {
        key: "recommendation",
        icon: "gift-outline",
        label: t("Recommendation"),
        onPress: () => {
          onPick?.();
          startRecommendTutorial();
          router.navigate("/search" as any);
        },
      },
      {
        key: "review",
        icon: "star-outline",
        label: t("Review"),
        onPress: () => {
          onPick?.();
          startReviewTutorial();
          router.navigate("/search" as any);
        },
      },
      {
        key: "analyze",
        icon: "document-text-outline",
        label: t("Analyze"),
        onPress: () => {
          onPick?.();
          startAnalyzeTutorial();
          // The Analyze tab is gone — "Analyze Profile" now lives in the
          // header's own username row on every category, no `?tab=` needed.
          router.navigate("/profile" as any);
        },
      },
      {
        key: "poll",
        icon: "stats-chart-outline",
        label: t("Poll"),
        onPress: () => {
          onPick?.();
          startPollTutorial();
          router.navigate("/to-watch" as any);
        },
      },
      {
        key: "badge",
        icon: "ribbon-outline",
        label: t("Badge"),
        onPress: () => {
          onPick?.();
          startBadgeTutorial();
          router.navigate("/profile?tab=badges" as any);
        },
      },
      {
        key: "list",
        icon: "albums-outline",
        label: t("List"),
        onPress: () => {
          onPick?.();
          startListTutorial();
          router.navigate("/lists" as any);
        },
      },
    ],
    [t, router, onPick, startRecommendTutorial, startReviewTutorial, startAnalyzeTutorial, startPollTutorial, startBadgeTutorial, startListTutorial]
  );
}
