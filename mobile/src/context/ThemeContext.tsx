import React, { createContext, useContext, useState } from "react";
import { Appearance, Text, TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import { PALETTES, THEME_NAMES, DEFAULT_THEME, type ThemeName, type ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";
import { STORAGE_KEYS } from "../constants/apiRoutes";
import { isLight } from "../utils/color";

// Android draws whatever a screen leaves unstyled — a text input's
// placeholder, the default text colour, the cursor and selection handles —
// in the phone's own light or dark mode unless the app says otherwise
// (app.json's userInterfaceStyle needs expo-system-ui to do that on Android,
// which this app doesn't have). Every palette is dark, so on a phone in light
// mode those came out black on a near-black screen: the sign-in fields'
// "Email"/"Password" couldn't be read (FB-23). The app's colour scheme
// follows the active palette instead. Android settles those colours when a
// view is created, so it's set here, as this module loads, before anything
// is drawn — and again whenever the theme changes.
let appliedScheme: "light" | "dark" | null = null;
function applyColorScheme(colors: ColorPalette) {
  const scheme = isLight(colors.base100) ? "light" : "dark";
  if (scheme === appliedScheme) return;
  appliedScheme = scheme;
  Appearance.setColorScheme(scheme);
}
applyColorScheme(PALETTES[DEFAULT_THEME]);

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ColorPalette;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Was previously a one-time mutation at the top of app/_layout.tsx, applied
// once at module load. Relocated here so it can be re-applied whenever the
// active theme changes — see the call site in ThemeProvider below for why
// it runs synchronously during render rather than in a useEffect.
//
// NOTE: React 19 applies defaultProps to class components only, and Text
// and TextInput are function components, so none of this takes effect any
// more: give text its colour, and a TextInput its placeholderTextColor,
// explicitly. What's left unstyled follows the colour scheme set above.
function applyGlobalTextDefaults(colors: ColorPalette) {
  const defaultTextProps = (Text as any).defaultProps || {};
  (Text as any).defaultProps = {
    ...defaultTextProps,
    style: [{ fontFamily: fonts.regular, color: colors.baseContent }],
  };
  const defaultInputProps = (TextInput as any).defaultProps || {};
  (TextInput as any).defaultProps = {
    ...defaultInputProps,
    style: [{ fontFamily: fonts.regular }],
    placeholderTextColor: colors.placeholder,
  };
}

export async function resolveInitialTheme(): Promise<ThemeName> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEYS.THEME);
  if (stored && (THEME_NAMES as readonly string[]).includes(stored)) {
    return stored as ThemeName;
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeName;
  children: React.ReactNode;
}) {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme);
  const colors = PALETTES[themeName];

  // Deliberate side effect during render (not in useEffect): Text/TextInput
  // defaultProps must be updated before children render in this same pass,
  // or plain <Text> elements (the vast majority of the app, which never set
  // color explicitly) would flash the old theme for one frame on every
  // switch. This is an idempotent global-object write, not derived from or
  // affecting this component's own output.
  applyGlobalTextDefaults(colors);
  applyColorScheme(colors);

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    SecureStore.setItemAsync(STORAGE_KEYS.THEME, name);
  };

  return (
    <ThemeContext.Provider value={{ themeName, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
