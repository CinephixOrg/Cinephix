import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize, adsAvailable } from "../../utils/adsModule";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useAdsConsent } from "../../context/AdsConsentContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  // Which AD_UNIT_IDS entry this placement shows — kept as a required prop
  // (not optional/defaulted) so every real call site has to name itself,
  // making it obvious at a glance which screens actually carry ads.
  unitId: string;
  style?: object;
}

// Free tier only, everywhere this is used — Plus/Premium never see an ad,
// no exceptions. A single shared component rather than each placement
// re-implementing the tier check + "Upgrade to remove ads" link separately,
// so that rule can't accidentally be forgotten at any of the many
// placements across the app (see AD_UNIT_IDS for the full list).
//
// The "Upgrade to remove ads" link only renders once a real ad has
// actually loaded — showing it over an empty/failed ad slot (no fill, no
// network) would read as a broken, orphaned link with nothing above it to
// justify it.
//
// One shape everywhere, deliberately: LARGE_ANCHORED_ADAPTIVE_BANNER (a
// wide, short strip — Google's own general-purpose "insert into a
// scrolling flow" shape, officially recommended over the older
// ANCHORED_ADAPTIVE_BANNER this used before). No placement in this app's
// spec needed a squarer box (MEDIUM_RECTANGLE) instead — every one of them
// is the same "break a vertical flow with a wide strip" case, including
// between card rows (Watched List/Watchlist) and between tiles (Socials'
// community boxes) — direct ask confirmed this reads fine without
// shape-matching the content around it, same as Instagram/Twitter's own
// inline feed ads.
export default function AdBanner({ unitId, style }: Props) {
  const { user } = useAuth();
  const { canRequestAds } = useAdsConsent();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const tier = user?.accountTier ?? "free";
  if (tier !== "free") return null;
  if (failed) return null;
  // Expo Go (or a dev-client build not yet rebuilt with this native
  // module) — see adsModule.ts's own comment. Renders nothing rather than
  // crashing the screen it's placed on.
  if (!adsAvailable || !BannerAd || !BannerAdSize) return null;
  // UMP/GDPR consent not yet resolved to "ads may be requested" — never
  // request a single ad anywhere until AdsConsentContext says so (see its
  // own comment). Not a failure state, so no `failed` flip here — once
  // consent resolves, `canRequestAds` flips true and this same instance
  // starts rendering a real ad on its own, no remount needed.
  if (!canRequestAds) return null;

  const styles = StyleSheet.create({
    wrap: { alignItems: "center", paddingVertical: 8 },
    upgradeLink: { marginTop: 6 },
    upgradeLinkText: { fontSize: 11.5, color: colors.placeholder, textDecorationLine: "underline" },
  });

  return (
    <View style={[styles.wrap, style]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setFailed(true)}
      />
      {loaded && (
        <Pressable style={styles.upgradeLink} onPress={() => router.navigate("/match/subscription" as any)}>
          <Text style={styles.upgradeLinkText}>{t("Upgrade to remove ads")}</Text>
        </Pressable>
      )}
    </View>
  );
}
