import * as WebBrowser from "expo-web-browser";

// The public Terms of Service and Privacy Policy.
//
// They're opened from the sign-up screen, where nobody is signed in yet, so
// they point at the public website rather than the in-app pages (which live
// behind the app's own authenticated stack). EXPO_PUBLIC_WEB_URL overrides
// the host for a staging site.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://cinephix-frontend.onrender.com";

export const LEGAL_URLS = {
  terms: `${WEB_URL}/terms`,
  privacy: `${WEB_URL}/privacy`,
};

export function openLegal(which: keyof typeof LEGAL_URLS) {
  WebBrowser.openBrowserAsync(LEGAL_URLS[which]).catch(() => {
    // Opening the browser failed; the checkbox still works.
  });
}
