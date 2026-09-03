import type { TFunction } from "i18next";
import type { ColorPalette } from "../../theme/palettes";
import type { MatchBreakdown } from "../../types";

// Heaviest-weighted first — matches the order computeMatchBreakdown (backend)
// combines these into matchPercentage, and the order MatchRadarChart draws
// its axes in.
export const CATEGORY_KEYS: (keyof MatchBreakdown)[] = [
  "collaborative",
  "contentBased",
  "social",
  "diversity",
  "bonus",
];

interface CategoryMeta {
  label: string;
  desc: string;
  color: string;
}

export function categoryMeta(key: keyof MatchBreakdown, colors: ColorPalette, t: TFunction): CategoryMeta {
  switch (key) {
    case "collaborative":
      return { label: t("Taste"), desc: t("How closely your genre ratings line up with theirs."), color: colors.primary };
    case "contentBased":
      return { label: t("Favorites"), desc: t("Overlap between the movies and shows you've both favorited."), color: colors.secondary };
    case "social":
      return { label: t("Social"), desc: t("Mutual follows and shared connections between you two."), color: colors.info };
    case "diversity":
      return {
        label: t("Variety"),
        desc: t("How wide-ranging your tastes are — whether you both explore lots of genres or stick to a few favorites."),
        color: colors.warning,
      };
    case "bonus":
      return { label: t("Activity"), desc: t("Recent activity overlap — what you've both been watching lately."), color: colors.success };
  }
}
