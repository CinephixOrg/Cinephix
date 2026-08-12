// Mobile's palette data for all 9 of web's DaisyUI themes (frontend/tailwind.config.js's
// daisyui.themes list). Web switches themes purely via CSS (`data-theme` attribute + DaisyUI's
// CSS custom properties) — React Native has no equivalent cascade, so every theme's full palette
// has to be materialized as plain data here and read reactively via ThemeContext instead.
//
// Values are DaisyUI 4.12.24's actual per-theme colors (its `dist/themes.css`, which stores
// tokens as OKLCH triplets — `oklch(var(--p))` etc. — converted to hex, since RN's style
// processor has no OKLCH parser and only accepts hex/rgb/hsl).
//
// `forest` is copied verbatim from the previous single-theme `colors.ts` (zero visual change to
// today's default) — its info/success/warning/error are hand-guessed Tailwind-style hex, since
// DaisyUI's `forest` entry never overrides those and the original author picked conventional
// values rather than forest's real (unstyled-default) computed colors. The other 8 themes DO
// define their own info/success/warning/error explicitly in DaisyUI's source (only `dark`
// inherits the same shared default forest effectively also uses) — those real per-theme values
// are used here instead of guessing, for internal consistency across the new palettes.
//
// `border`/`placeholder` have no DaisyUI equivalent at all in any theme (pure invention, first
// introduced for forest: border sits a little lighter than base300 toward baseContent,
// placeholder is baseContent dimmed toward base100). The same two-value derivation formula
// (border = base300 blended 15% toward baseContent; placeholder = baseContent blended 45%
// toward base100) was applied via a one-off script for the 8 new themes, to keep 16 derived
// values consistent rather than hand-picking hex by eye.
export interface ColorPalette {
  primary: string;
  primaryContent: string;
  secondary: string;
  accent: string;
  neutral: string;
  neutralContent: string;

  base100: string;
  base200: string;
  base300: string;
  baseContent: string;

  info: string;
  success: string;
  warning: string;
  error: string;

  border: string;
  placeholder: string;
}

export const THEME_NAMES = [
  "forest",
  "dark",
  "dim",
  "black",
  "luxury",
  "dracula",
  "sunset",
  "synthwave",
  "coffee",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const DEFAULT_THEME: ThemeName = "forest";

export const PALETTES: Record<ThemeName, ColorPalette> = {
  forest: {
    primary: "#1eb854",
    primaryContent: "#000000",
    secondary: "#1DB88E",
    accent: "#1DB8AB",
    neutral: "#19362D",
    neutralContent: "#ffffff",

    base100: "#171212",
    base200: "#100e0e",
    base300: "#0b0a0a",
    baseContent: "#d6d6d6",

    info: "#2563eb",
    success: "#16a34a",
    warning: "#d97706",
    error: "#e0555f",

    border: "#2c2626",
    placeholder: "#8a8080",
  },
  dark: {
    primary: "#7480ff",
    primaryContent: "#050617",
    secondary: "#ff52d9",
    accent: "#00cdb7",
    neutral: "#2a323c",
    neutralContent: "#a6adbb",

    base100: "#1d232a",
    base200: "#191e24",
    base300: "#15191e",
    baseContent: "#a6adbb",

    info: "#00b5ff",
    success: "#00a96e",
    warning: "#ffbe00",
    error: "#ff5861",

    border: "#2b2f36",
    placeholder: "#686f7a",
  },
  dim: {
    primary: "#9fe88d",
    primaryContent: "#091307",
    secondary: "#ff7d5c",
    accent: "#c792e9",
    neutral: "#1c212b",
    neutralContent: "#b2ccd6",

    base100: "#2a303c",
    base200: "#242933",
    base300: "#20252e",
    baseContent: "#b2ccd6",

    info: "#28ebff",
    success: "#62efbd",
    warning: "#efd057",
    error: "#ffae9b",

    border: "#363e47",
    placeholder: "#758691",
  },
  black: {
    primary: "#373737",
    primaryContent: "#d3d3d3",
    secondary: "#373737",
    accent: "#373737",
    neutral: "#373737",
    neutralContent: "#d3d3d3",

    base100: "#000000",
    base200: "#141414",
    base300: "#262626",
    baseContent: "#d6d6d6",

    info: "#0000ff",
    success: "#008000",
    warning: "#ffff00",
    error: "#ff0000",

    border: "#404040",
    placeholder: "#767676",
  },
  luxury: {
    primary: "#ffffff",
    primaryContent: "#161616",
    secondary: "#152747",
    accent: "#513448",
    neutral: "#331800",
    neutralContent: "#ffe7a3",

    base100: "#09090b",
    base200: "#171618",
    base300: "#2e2d2f",
    baseContent: "#dca54c",

    info: "#66c6ff",
    success: "#87d039",
    warning: "#e2d562",
    error: "#ff6f6f",

    border: "#483f33",
    placeholder: "#7d5f2f",
  },
  dracula: {
    primary: "#ff79c6",
    primaryContent: "#16050e",
    secondary: "#bd93f9",
    accent: "#ffb86c",
    neutral: "#414558",
    neutralContent: "#d6d7db",

    base100: "#282a36",
    base200: "#232530",
    base300: "#1f202a",
    baseContent: "#f8f8f2",

    info: "#8be9fd",
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",

    border: "#404048",
    placeholder: "#9a9b9d",
  },
  sunset: {
    primary: "#ff865b",
    primaryContent: "#160603",
    secondary: "#fd6f9c",
    accent: "#b387fa",
    neutral: "#1b262c",
    neutralContent: "#94a0a9",

    base100: "#121c22",
    base200: "#0e171e",
    base300: "#091319",
    baseContent: "#9fb9d0",

    info: "#89e0eb",
    success: "#addfad",
    warning: "#f1c891",
    error: "#ffbbbd",

    border: "#202c34",
    placeholder: "#607282",
  },
  synthwave: {
    primary: "#e779c1",
    primaryContent: "#13050e",
    secondary: "#58c7f3",
    accent: "#ffd200",
    neutral: "#221551",
    neutralContent: "#f9f7fd",

    base100: "#1a103d",
    base200: "#170d36",
    base300: "#130b30",
    baseContent: "#f9f7fd",

    info: "#53c0f3",
    success: "#71ead2",
    warning: "#eace6c",
    error: "#ec8c78",

    border: "#362e4f",
    placeholder: "#958fa7",
  },
  coffee: {
    primary: "#db924b",
    primaryContent: "#110802",
    secondary: "#263e3f",
    accent: "#10576d",
    neutral: "#120c12",
    neutralContent: "#c9c7c9",

    base100: "#20161f",
    base200: "#1c131b",
    base300: "#181017",
    baseContent: "#c59f60",

    info: "#8dcac1",
    success: "#9db787",
    warning: "#ffd25f",
    error: "#fc9581",

    border: "#322522",
    placeholder: "#7b6143",
  },
};
