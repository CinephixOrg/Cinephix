import React, { createContext, useContext, useState } from "react";
import { Text, TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import { PALETTES, THEME_NAMES, DEFAULT_THEME, type ThemeName, type ColorPalette } from "../theme/palettes";
import { fonts } from "../theme/typography";
import { STORAGE_KEYS } from "../constants/apiRoutes";

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
