import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AdsConsent, adsAvailable, mobileAds } from "../utils/adsModule";

interface AdsConsentState {
  /** False until UMP/GDPR consent has been gathered AND resolved to "ads
   * may be requested" — either the user consented, or consent genuinely
   * isn't required for them (outside a regulated geography). Every
   * AdBanner instance reads this instead of calling AdsConsent itself, so
   * a user who hasn't resolved consent yet never gets a single ad request
   * attempted anywhere in the app. */
  canRequestAds: boolean;
}

const AdsConsentContext = createContext<AdsConsentState>({ canRequestAds: false });

export function useAdsConsent() {
  return useContext(AdsConsentContext);
}

// Gathers UMP/GDPR consent before ever initializing the Mobile Ads SDK —
// direct requirement from the library's own integration guidance ("Gather
// UMP/ATT consent and set request configuration before
// mobileAds().initialize(). Ads may preload on init."). AdsConsent.gatherConsent()
// is the library's own one-call convenience (requestInfoUpdate +
// loadAndShowConsentFormIfRequired) — it shows the actual consent form only
// when the user's own geography requires it (EEA/UK and similar); everyone
// else resolves straight through with nothing shown. Only once that's
// settled do we check canRequestAds and, if true, initialize() — never
// initialize unconditionally the way this used to (app/_layout.tsx's
// original version, before a real AdMob account made this a real
// pre-launch requirement rather than a deferred one).
export function AdsConsentProvider({ children }: { children: ReactNode }) {
  const [canRequestAds, setCanRequestAds] = useState(false);

  useEffect(() => {
    if (!adsAvailable || !AdsConsent || !mobileAds) return;
    const consent = AdsConsent;
    const ads = mobileAds;
    consent
      .gatherConsent()
      .then(() => consent.getConsentInfo())
      .then((info: { canRequestAds: boolean }) => {
        if (!info.canRequestAds) return;
        setCanRequestAds(true);
        return ads().initialize();
      })
      .catch(() => {});
  }, []);

  return <AdsConsentContext.Provider value={{ canRequestAds }}>{children}</AdsConsentContext.Provider>;
}
