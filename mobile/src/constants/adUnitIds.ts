import { Platform } from "react-native";
// NOT imported directly from "react-native-google-mobile-ads" — see
// adsModule.ts's own comment on why even a named-export-only import of this
// package crashes Expo Go/an un-rebuilt dev-client.
import { TestIds } from "../utils/adsModule";

// Google's own official test ad unit IDs — always safe to show, never real
// inventory. Used for every placement until USE_REAL_AD_UNITS below is
// flipped on.
const TEST_IDS = {
  SHARES_FEED_BANNER: TestIds.BANNER,
  DISCOVER_BANNER: TestIds.BANNER,
  SEARCH_BANNER: TestIds.BANNER,

  SYNC_INTRO_BANNER: TestIds.BANNER,
  SYNC_FILTERS_BANNER: TestIds.BANNER,
  SYNC_RESULTS_BANNER: TestIds.BANNER,

  SOCIALS_BANNER: TestIds.BANNER,
  DM_BANNER: TestIds.BANNER,

  PROFILE_POSTS_BANNER: TestIds.BANNER,
  PROFILE_FAVORITES_BANNER: TestIds.BANNER,
  PROFILE_CINEGRAPH_BANNER: TestIds.BANNER,
  PROFILE_ANALYSES_BANNER: TestIds.BANNER,
  PROFILE_BADGES_BANNER: TestIds.BANNER,

  WATCHED_LIST_BANNER: TestIds.BANNER,
  WATCHLIST_BANNER: TestIds.BANNER,
  LISTS_TAB_BANNER: TestIds.BANNER,

  CONTENT_DETAIL_BANNER: TestIds.BANNER,
  CONTENT_LISTS_BANNER: TestIds.BANNER,
  CONTENT_REVIEWS_BANNER: TestIds.BANNER,
};

// Real per-placement, per-platform ad unit IDs from the AdMob dashboard
// (Apps > Cinephix > Ad units — a separate Android app and iOS app, each
// with their own 19 ad units), filled in as the user creates each one
// there. Deliberately kept in a SEPARATE object from TEST_IDS rather than
// overwriting entries one at a time as they're created — direct ask,
// confirmed via AskUserQuestion: the first native build uses test IDs
// across the board so the native integration itself is verified before
// real ad serving becomes a second variable, and a real ID landing here the
// moment it's created must not silently flip that one placement over
// early. `null` means "not created yet for this platform" — resolve()
// below falls back to the test ID for any platform/placement pair still
// null even once USE_REAL_AD_UNITS is eventually turned on, so a partially
// filled-in set never sends an empty/undefined unitId to BannerAd. Same
// `Platform.select`-per-key shape the library's own TestIds uses, since a
// banner's real unitId is never interchangeable between Android and iOS.
const REAL_IDS: Record<keyof typeof TEST_IDS, { android: string | null; ios: string | null }> = {
  SHARES_FEED_BANNER: { android: "ca-app-pub-8572881441508627/6811592915", ios: "ca-app-pub-8572881441508627/3657892529" },
  DISCOVER_BANNER: { android: "ca-app-pub-8572881441508627/3111097616", ios: "ca-app-pub-8572881441508627/6599664917" },
  SEARCH_BANNER: { android: "ca-app-pub-8572881441508627/8372086596", ios: "ca-app-pub-8572881441508627/7704948747" },

  SYNC_INTRO_BANNER: { android: "ca-app-pub-8572881441508627/3993857883", ios: "ca-app-pub-8572881441508627/7083055654" },
  SYNC_FILTERS_BANNER: { android: "ca-app-pub-8572881441508627/6683425394", ios: "ca-app-pub-8572881441508627/1139540390" },
  SYNC_RESULTS_BANNER: { android: "ca-app-pub-8572881441508627/3008079279", ios: "ca-app-pub-8572881441508627/4788064802" },

  SOCIALS_BANNER: { android: "ca-app-pub-8572881441508627/4057262058", ios: "ca-app-pub-8572881441508627/4711868175" },
  DM_BANNER: { android: "ca-app-pub-8572881441508627/1431098712", ios: "ca-app-pub-8572881441508627/3143810641" },

  PROFILE_POSTS_BANNER: { android: "ca-app-pub-8572881441508627/4531990496", ios: "ca-app-pub-8572881441508627/6975244444" },
  PROFILE_FAVORITES_BANNER: { android: "ca-app-pub-8572881441508627/6491853709", ios: "ca-app-pub-8572881441508627/4887213714" },
  PROFILE_CINEGRAPH_BANNER: { android: "ca-app-pub-8572881441508627/2744355394", ios: "ca-app-pub-8572881441508627/9852514215" },
  PROFILE_ANALYSES_BANNER: { android: "ca-app-pub-8572881441508627/3802286197", ios: "ca-app-pub-8572881441508627/1099926227" },
  PROFILE_BADGES_BANNER: { android: "ca-app-pub-8572881441508627/1047955338", ios: "ca-app-pub-8572881441508627/1974024191" },

  WATCHED_LIST_BANNER: { android: "ca-app-pub-8572881441508627/1092362372", ios: "ca-app-pub-8572881441508627/9545567468" },
  WATCHLIST_BANNER: { android: "ca-app-pub-8572881441508627/8088092121", ios: "ca-app-pub-8572881441508627/1894133144" },
  LISTS_TAB_BANNER: { android: "ca-app-pub-8572881441508627/1414872569", ios: "ca-app-pub-8572881441508627/8232485799" },

  CONTENT_DETAIL_BANNER: { android: "ca-app-pub-8572881441508627/5461928783", ios: "ca-app-pub-8572881441508627/3283411445" },
  CONTENT_LISTS_BANNER: { android: "ca-app-pub-8572881441508627/4148847118", ios: "ca-app-pub-8572881441508627/8634887032" },
  CONTENT_REVIEWS_BANNER: { android: "ca-app-pub-8572881441508627/2835765445", ios: "ca-app-pub-8572881441508627/4831373399" },
};

// Flip this to true only once asked to — the agreed sequencing is: first
// native build on test IDs everywhere (verifies the integration itself),
// then a single deliberate switch to real IDs once that's confirmed
// working. Never flip this as a side effect of filling in REAL_IDS entries.
const USE_REAL_AD_UNITS = false;

function resolve(key: keyof typeof TEST_IDS): string {
  if (USE_REAL_AD_UNITS) {
    const real = Platform.OS === "ios" ? REAL_IDS[key].ios : REAL_IDS[key].android;
    if (real) return real;
  }
  return TEST_IDS[key];
}

export const AD_UNIT_IDS: Record<keyof typeof TEST_IDS, string> = Object.fromEntries(
  (Object.keys(TEST_IDS) as (keyof typeof TEST_IDS)[]).map((key) => [key, resolve(key)])
) as Record<keyof typeof TEST_IDS, string>;
