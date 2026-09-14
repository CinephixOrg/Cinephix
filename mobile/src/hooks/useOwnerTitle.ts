import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { fetchPublicProfile, getCachedPublicProfile } from "../api/publicProfileCache";

/**
 * Titles a page belonging to someone else's profile with its owner's name,
 * e.g. "@ana's Watched List".
 *
 * The username normally comes from the profile the page was opened from,
 * already cached, so the title is right before the first paint (set in a
 * layout effect, over an empty title in the stack layout). Opened without it
 * (a deep link), the plain title shows until the profile loads.
 *
 * @param titleKey    i18n key with a {{username}} placeholder
 * @param fallbackKey i18n key used until the username is known
 */
export function useOwnerTitle(userId: string | undefined, titleKey: string, fallbackKey: string) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [username, setUsername] = useState(() => (userId ? getCachedPublicProfile(userId)?.profile.username : undefined));

  useEffect(() => {
    if (username || !userId) return;
    let cancelled = false;
    fetchPublicProfile(userId)
      .then((bundle) => {
        if (!cancelled) setUsername(bundle.profile.username);
      })
      .catch(() => {
        // The plain title stays.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, username]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: username ? t(titleKey, { username }) : t(fallbackKey) });
  }, [navigation, username, titleKey, fallbackKey, t]);
}
