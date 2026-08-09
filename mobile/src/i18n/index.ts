import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { resources } from "../locales";
import { STORAGE_KEYS } from "../constants/apiRoutes";

export const SUPPORTED_LANGUAGES = Object.keys(resources);

// Web's equivalent (frontend/src/i18n.js) uses i18next-browser-languagedetector,
// which only works in a browser. This is the RN-idiomatic hand-rolled
// equivalent: a persisted user override wins, else the device's locale (if
// supported), else English.
async function resolveInitialLanguage(): Promise<string> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEYS.LANGUAGE);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const deviceCode = Localization.getLocales()[0]?.languageCode;
  if (deviceCode && SUPPORTED_LANGUAGES.includes(deviceCode)) return deviceCode;

  return "en";
}

let initPromise: Promise<void> | null = null;

export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const lng = await resolveInitialLanguage();
      await i18next.use(initReactI18next).init({
        resources,
        lng,
        fallbackLng: "en",
        interpolation: { escapeValue: false },
      });
    })();
  }
  return initPromise;
}

export async function changeLanguage(code: string): Promise<void> {
  await i18next.changeLanguage(code);
  await SecureStore.setItemAsync(STORAGE_KEYS.LANGUAGE, code);
}

export default i18next;
