import { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getMyPodiumPlacements } from "../api/feedService";
import { STORAGE_KEYS } from "../constants/apiRoutes";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { PodiumPlacement } from "../types";

// Maps the backend's own PeopleLeaderboardResult field names (what
// GET /feed/my-podium-placements returns) onto PeoplePodium.tsx's own
// shorter CategoryKey union (used as the `?podiumCategory=` value that
// component reads to know which page to jump to) and that same category's
// already-established translated title — kept in one place so this modal
// and that component never drift on what a given backend key means.
const CATEGORY_INFO: Record<PodiumPlacement["category"], { key: string; titleKey: string }> = {
  mostFollowed: { key: "followed", titleKey: "Most Followed" },
  mostWatched: { key: "watched", titleKey: "Most Watched" },
  mostReviewed: { key: "reviewed", titleKey: "Most Reviewed" },
  mostLiked: { key: "liked", titleKey: "Most Liked" },
  topRecommenders: { key: "recommended", titleKey: "Top Recommenders" },
  mostBadges: { key: "badges", titleKey: "Most Decorated" },
};

// The "you made the podium!" popup — checked once per app session (this
// component is only ever mounted inside app/(app)/_layout.tsx, which
// itself only renders once `user` exists, and unmounts on logout, so a
// fresh login is the only thing that re-triggers the check). Free/Plus
// viewers get exactly the same popup as Premium — the tap target
// (`?podiumCategory=`) always lands on the right category, real page or
// the shared ad page depending on the viewer's own tier. That ad page
// never highlights the viewer's own entry (a self-highlight was tried and
// reverted — see PeoplePodium.tsx's own doc comment: the ad page's whole
// appeal is staying a fixed, empty silhouette, the same for every viewer
// regardless of their own placement), so a Free/Plus viewer landing there
// after tapping this popup sees the same locked-category tease everyone
// else does, not a special reveal of themselves.
//
// Direct correction: an earlier version showed this on *every* login the
// placement was still true, not just the first — a user who stays #1 in
// Most Liked for a week would see the same "great news" every single time
// they opened the app. Fixed with the same SecureStore "seen once" pattern
// match/index.tsx's own SyncIntroCard already established
// (STORAGE_KEYS.SYNC_INTRO_SEEN) — just keyed on the placement's own
// signature (`"<category>:<rank>"`) instead of a plain boolean, so an
// *unchanged* placement stays silent on repeat logins, but a genuinely new
// one (a new category, or an improved/worsened rank on the same one)
// still shows — that's real news, not a repeat.
export default function PodiumNewsModal() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [placement, setPlacement] = useState<PodiumPlacement | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyPodiumPlacements(), SecureStore.getItemAsync(STORAGE_KEYS.LAST_SHOWN_PODIUM_PLACEMENT)]).then(([res, lastShown]) => {
      if (cancelled || res.placements.length === 0) return;
      // A user can rank on more than one podium at once — feature the
      // single best (lowest) rank; ties keep whichever the backend's own
      // fixed category order already put first (PODIUM_CATEGORY_KEYS).
      const best = [...res.placements].sort((a, b) => a.rank - b.rank)[0];
      const signature = `${best.category}:${best.rank}`;
      if (signature === lastShown) return;
      setPlacement(best);
      SecureStore.setItemAsync(STORAGE_KEYS.LAST_SHOWN_PODIUM_PLACEMENT, signature);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
        dismissZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        card: {
          width: "100%",
          maxWidth: 360,
          backgroundColor: colors.base200,
          borderRadius: 20,
          paddingVertical: 28,
          paddingHorizontal: 24,
          alignItems: "center",
        },
        closeButton: { position: "absolute", top: 12, right: 12, padding: 4 },
        iconWrap: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "rgba(255,201,74,0.15)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        },
        title: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, textAlign: "center", marginBottom: 8 },
        body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.baseContent, textAlign: "center" },
      }),
    [colors]
  );

  if (!placement) return null;

  const info = CATEGORY_INFO[placement.category];
  const categoryTitle = t(info.titleKey);

  const dismiss = () => setPlacement(null);
  // router.navigate, not router.push — this modal shows right at app
  // launch, when the Media/Home tab (and its own SharesFeedSection/
  // PeoplePodium, already fetching or already loaded) is almost always
  // already mounted underneath it. `push` always stacks a *new* screen
  // instance regardless, which was a real reported bug: a second
  // `home/index.tsx` (and everything inside it) mounted fresh and re-fetched
  // from scratch, on top of the one already loading/loaded behind it —
  // "arkada sayfa yüklenmişse... bir daha yüklediği için 2 yükleme
  // gerçekleşiyor". `navigate` reuses the existing screen instance and just
  // updates its params in place when the target is already the current
  // screen, so home/index.tsx's own `podiumCategory` param changes without
  // ever remounting anything underneath it.
  const goToPodium = () => {
    setPlacement(null);
    router.navigate(`/home?podiumCategory=${info.key}` as any);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={dismiss} />
        <Pressable style={styles.card} onPress={goToPodium}>
          <Pressable style={styles.closeButton} onPress={dismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.placeholder} />
          </Pressable>
          <View style={styles.iconWrap}>
            <Ionicons name="trophy" size={32} color="#FFC94A" />
          </View>
          <Text style={styles.title}>{t("We've got great news for you!")}</Text>
          <Text style={styles.body}>
            {t("You're #{{rank}} in the {{category}} podium! Tap to see it.", { rank: placement.rank, category: categoryTitle })}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
