import type { Ionicons } from "@expo/vector-icons";
import { readableOn } from "../../utils/color";
import type { ColorPalette } from "../../theme/palettes";
import type { GroupCategory } from "../../types";

type IconName = keyof typeof Ionicons.glyphMap;

// Each community category's colour and icon, shared by the cards, the filter
// menu and a community's own page so a category reads the same everywhere.
//
// Fixed hues rather than theme colours: several themes make `secondary` and
// `accent` near-identical teals, which would make two categories look like
// one. Each hue has a lighter shade for dark themes and a deeper one for
// light themes, so the hashtag text stays readable on both.
const HUES: Record<GroupCategory, { dark: string; light: string; icon: IconName }> = {
  genre: { dark: "#F472B6", light: "#DB2777", icon: "film-outline" },
  director: { dark: "#A78BFA", light: "#7C3AED", icon: "videocam-outline" },
  era: { dark: "#FBBF24", light: "#B45309", icon: "hourglass-outline" },
  style: { dark: "#22D3EE", light: "#0E7490", icon: "color-palette-outline" },
};

export interface CategoryTone {
  /** Text and icons. */
  color: string;
  /** A soft fill behind them. */
  tint: string;
  icon: IconName;
}

export function isDarkTheme(colors: ColorPalette): boolean {
  return readableOn(colors.base100) === "#ffffff";
}

// One object per category and shade, so memoized components handed a tone
// don't re-render for an equal-but-new one.
const tones = new Map<string, CategoryTone>();

export function categoryTone(category: GroupCategory, dark: boolean): CategoryTone {
  const key = `${category}|${dark}`;
  let tone = tones.get(key);
  if (!tone) {
    const hue = HUES[category] ?? HUES.genre;
    const color = dark ? hue.dark : hue.light;
    tone = { color, tint: `${color}${dark ? "26" : "1A"}`, icon: hue.icon };
    tones.set(key, tone);
  }
  return tone;
}
