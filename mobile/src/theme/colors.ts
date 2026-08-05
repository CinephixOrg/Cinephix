// Cinephix web uses DaisyUI's built-in "forest" theme (frontend default,
// frontend/index.html: localStorage.getItem('theme') || 'forest').
// Values below are taken directly from
// frontend/node_modules/daisyui/src/theming/themes.js's `forest` entry;
// base-200/300/content and info/success/warning/error aren't overridden by
// forest there, so those are derived from DaisyUI's usual dark-theme
// conventions (progressively darker base surfaces, light content on dark).
export const colors = {
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
};
