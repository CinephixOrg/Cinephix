// `react-native-google-mobile-ads` is a real native module — its own
// `MobileAds.ts` calls `TurboModuleRegistry.getEnforcing(...)` directly at
// import time (not inside a function), which throws immediately and takes
// down the ENTIRE app the moment anything imports the package, anywhere it
// can't find the compiled native module. Expo Go only ships a fixed set of
// pre-bundled native modules and can never have this one — real bug,
// reported live: a plain top-level `import` of this package in
// app/_layout.tsx crashed every single screen in Expo Go, not just
// wherever an ad would eventually render.
//
// A `Constants.executionEnvironment` check isn't precise enough to guard
// against this on its own — `ExecutionEnvironment.StoreClient` covers BOTH
// Expo Go AND a dev-client build that simply hasn't been rebuilt with this
// native module yet, and a real dev-client build that HAS the module
// should still get real ads. The actual thing that matters is whether the
// native module is really there, not which environment this claims to be
// — so this does a guarded `require()` once, at module load, and every
// real call site (app/_layout.tsx's SDK init, AdBanner.tsx's BannerAd)
// reads from here instead of importing the package directly. Until a real
// dev-client rebuild includes this native module, `adsAvailable` is false
// everywhere and every ad-related call site silently no-ops instead of
// crashing — exactly the same safe-degradation this needs once a real
// build exists too, for the dev-client-before-its-next-rebuild case.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let nativeModule: typeof import("react-native-google-mobile-ads") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nativeModule = require("react-native-google-mobile-ads");
} catch {
  nativeModule = null;
}

export const adsAvailable = nativeModule != null;
export const mobileAds = nativeModule?.default ?? null;
export const BannerAd = nativeModule?.BannerAd ?? null;
export const BannerAdSize = nativeModule?.BannerAdSize ?? null;
// UMP/GDPR consent (AdsConsent.gatherConsent/getConsentInfo) — same guard,
// same reasoning: it's part of this same native module, so it's unavailable
// in Expo Go/un-rebuilt dev-client exactly when everything else above is.
export const AdsConsent = nativeModule?.AdsConsent ?? null;
// TestIds — same guard, same reasoning. A real bug, caught live a second
// time: adUnitIds.ts used to import { TestIds } directly from the package,
// which still crashed Expo Go even though TestIds itself is just a plain
// Platform.select object with no TurboModule call of its own — importing
// ANY named export evaluates the package's whole index.ts, which pulls in
// MobileAds.ts (the one that actually throws) regardless of which export
// you asked for. Falls back to an all-empty-string shape (BannerAd.unitId
// is never read anyway — AdBanner.tsx's own adsAvailable guard means
// nothing renders a <BannerAd> with this value when it's unavailable).
export const TestIds = nativeModule?.TestIds ?? {
  APP_OPEN: "",
  ADAPTIVE_BANNER: "",
  BANNER: "",
  INTERSTITIAL: "",
  REWARDED: "",
  REWARDED_INTERSTITIAL: "",
  NATIVE: "",
  NATIVE_VIDEO: "",
};
