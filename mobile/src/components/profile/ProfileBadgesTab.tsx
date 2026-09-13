import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  getGenreBadges,
  getVolumeBadges,
  getRatingCountBadge,
  getReviewCountBadge,
  getListCountBadge,
  getFollowersBadge,
  getInfluencerBadge,
  getPodiumBadge,
  getFirstSyncBadge,
  getHighMatchBadge,
  getSyncExplorerBadge,
  getFoundingCinephileBadge,
  getMembershipBadge,
  getStreakBadge,
  getTimeTravelerBadge,
  getEclecticTasteBadge,
  getDayOneViewerBadge,
  getHiddenGemBadge,
  getPollParticipantBadge,
  getHalloweenViewerBadge,
  getNewYearViewerBadge,
  getAllBadgesForUser,
} from "../../api/badgeService";
import { GENRE_BADGE_DEFINITIONS } from "../../data/genreBadgeDefinitions";
import { VOLUME_BADGE_DEFINITIONS, VOLUME_TIER_ORDER } from "../../data/volumeBadgeDefinitions";
import { ACTIVITY_BADGE_DEFINITIONS, ACTIVITY_TIER_ORDER } from "../../data/activityBadgeDefinitions";
import { SOCIAL_BADGE_DEFINITIONS, SOCIAL_TIER_ORDER } from "../../data/socialBadgeDefinitions";
import { SYNC_BADGE_DEFINITIONS } from "../../data/syncBadgeDefinitions";
import {
  FOUNDING_CINEPHILE_DEFINITION,
  MEMBERSHIP_BADGE_DEFINITION,
  MEMBERSHIP_TIER_ORDER,
  STREAK_BADGE_DEFINITION,
  STREAK_TIER_ORDER,
} from "../../data/loyaltyBadgeDefinitions";
import { SEASONAL_BADGE_DEFINITIONS } from "../../data/seasonalBadgeDefinitions";
import { SPECIAL_BADGE_DEFINITIONS } from "../../data/specialBadgeDefinitions";
import BadgeDetailModal, { type BadgeDetailData, type BadgeTierOption } from "./BadgeDetailModal";
import type { ActivityBadgeResponse, GenreBadge, GenreBadgesResponse, VolumeBadge, VolumeBadgesResponse, VolumeTier } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

// A locked tile's own image is a real flat silhouette of the SAME artwork
// (RN's built-in `tintColor`, which recolors every non-transparent pixel to
// one solid color while leaving the alpha/shape exactly as the PNG drew
// it) rather than a placeholder or a second grayscale asset — direct ask:
// "kenarlarını koruyacak şekilde düz gri renk." No extra image-processing
// dependency needed for this; it's a built-in Image style prop.
const LOCKED_OPACITY = 0.55;

// 4 across, flat grid — every genre/tier combination is its own tile
// labeled with its full name ("Action Devotee") rather than grouped under
// a genre heading with a short tier label underneath, direct ask to make
// this whole tab more compact. No checkmark on an earned tile and no
// "13/15" caption under a locked one anymore either (direct ask, second
// pass) — full color already reads as "earned" on its own, and progress
// now lives in the tap-to-open detail popup (BadgeDetailModal) instead of
// being printed under every tile.
const COLUMNS = 4;
const GRID_GAP = 10;
const CONTAINER_PADDING = 20;

// Display names for the volume ladder's own 5 tiers — a made-up rank
// title per rung ("Amateur" through "Cinephile") instead of the literal
// medal-tier words (Bronze/Silver/Gold/...), direct ask. `tier` itself
// (the backend/type-level string, "bronze"|"silver"|...) never changes —
// only what gets displayed for it does, so this is purely a presentation
// table, same role genreBadgeDefinitions.ts's own `label` plays for genre
// keys. "Cinephile" at the top deliberately reuses the app's own existing
// word for its most devoted users (see the "Follow other cinephiles..."
// string) — the same word the maxed-out sentence below already uses.
const VOLUME_TIER_LABEL_KEY: Record<VolumeTier, string> = {
  bronze: "Amateur",
  silver: "Enthusiast",
  gold: "Aficionado",
  platinum: "Connoisseur",
  diamond: "Cinephile",
};

function BadgeTile({
  width,
  image,
  label,
  earned,
  onPress,
}: {
  width: number;
  image: number;
  label: string;
  earned: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildTileStyles(colors), [colors]);

  return (
    <Pressable style={[styles.tile, { width }]} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image
          source={image}
          style={[styles.image, !earned && { tintColor: colors.placeholder, opacity: LOCKED_OPACITY }]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// The "rank/ladder" counterpart to BadgeTile's "collection" tiles — one
// slot per ladder category instead of one tile per rung, direct ask after
// seeing how the game genre badges looked ("oyunlardaki gibi... tek bir
// slota mı koysak"). Used for volume (movies/series) AND the 3 activity
// ladders (ratings/reviews/lists) — same shape regardless of how many
// rungs a given ladder has (`totalDots`), so this one component serves
// every "one slot + level-dot" badge, not just volume's own. Shows the
// artwork for whichever tier has actually been reached (lowest-rung art,
// tinted gray/locked, when none has); the dots underneath are the "how
// far up the ladder" read at a glance a single static image can't give.
function LadderTile({
  width,
  image,
  label,
  filledDots,
  totalDots,
  earned,
  onPress,
}: {
  width: number;
  image: number;
  label: string;
  filledDots: number;
  totalDots: number;
  earned: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildTileStyles(colors), [colors]);

  return (
    <Pressable style={[styles.tile, { width }]} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image
          source={image}
          style={[styles.image, !earned && { tintColor: colors.placeholder, opacity: LOCKED_OPACITY }]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalDots }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < filledDots ? colors.primary : colors.base300 }]} />
        ))}
      </View>
    </Pressable>
  );
}

// Shared ladder-tile builder — every "one slot + level-dot" badge (volume's
// movies/series, and the 3 activity ladders) goes through this exact same
// logic, just with different data (tier order, art, threshold table, rank
// words). `progressKey`/`unlockKey` are passed in rather than hardcoded
// because volume's own sentences say "watched" (its real verb) while the
// activity ladders' own say "have" (rating/reviewing/listing don't share
// one verb) — see locales' own two key sets for the exact wording. The 3
// description branches (active rung / already-surpassed rung / not-yet-
// reached rung tapped directly) are the same rule this file's own past
// comment already explains: naming a LOCKED rung's own requirement is
// fine only when the user chose to look at that exact future badge in the
// strip, never in the default/active view.
function buildLadderTile(
  t: TFunction,
  {
    count,
    tier,
    tierOrder,
    tierImages,
    tierThresholds,
    tierWord,
    label,
    displayLabel = label,
    progressKey,
    unlockKey,
    titleFor = (word, lbl) => `${word} ${lbl}`,
    buildEarnedText = (word, lbl) => t("You've earned the {{tier}} {{label}} badge!", { tier: word, label: lbl }),
    buildMaxedText = (word, lbl) =>
      t("You're a true cinephile! You've earned the {{tier}} {{label}} badge — the highest tier!", { label: lbl, tier: word }),
  }: {
    count: number;
    tier: string | null;
    tierOrder: string[];
    tierImages: Record<string, number>;
    tierThresholds: { tier: string; threshold: number }[];
    tierWord: (tier: string) => string;
    label: string;
    // What the GRID tile's own caption shows (not the detail popup, which
    // always uses the active tier's full title) — defaults to `label`
    // itself, same as every ladder that only has one natural noun
    // (volume's "Movies"/"Series", activity's "Ratings"/"Reviews"/
    // "Lists"). Streak and membership both share the same sentence-noun
    // ("Days"), which would make two adjacent grid tiles read identically
    // ("Days" next to "Days") — this lets each pick its own distinct
    // caption while still sharing "Days" for the count sentences.
    displayLabel?: string;
    progressKey: string;
    unlockKey: string;
    // Overrides how a rung's own title is built from its rank word + the
    // ladder's own `label` — every ladder besides streak wants "{{word}}
    // {{label}}" (e.g. "Amateur Movies"), but streak's own tier "words"
    // are already complete, self-contained phrases ("7-Day Streak") that
    // would read wrong with "Days" appended after them.
    titleFor?: (word: string, label: string) => string;
    // Same reasoning as `titleFor`, for the "already earned this rung" and
    // "reached the top rung" sentences — both bake in "{{tier}} {{label}}"
    // by default, which streak's own self-contained tier words don't want
    // either.
    buildEarnedText?: (word: string, label: string) => string;
    buildMaxedText?: (word: string, label: string) => string;
  }
) {
  const currentTierIndex = tier ? tierOrder.indexOf(tier) : -1;
  const earned = tier !== null;
  const activeIndex = currentTierIndex >= 0 ? currentTierIndex : 0;
  const image = tierImages[tier ?? tierOrder[0]];

  const tierOptions: BadgeTierOption[] = tierOrder.map((tierName, i) => {
    const tierIsEarned = i <= currentTierIndex;
    const word = tierWord(tierName);
    const threshold = tierThresholds.find((v) => v.tier === tierName)?.threshold ?? 0;

    let description: string;
    if (i === activeIndex) {
      const isMaxed = tierIsEarned && i === tierOrder.length - 1;
      if (isMaxed) {
        description = buildMaxedText(word, label);
      } else {
        const nextThreshold = tierIsEarned ? tierThresholds.find((v) => v.tier === tierOrder[i + 1])?.threshold ?? 0 : threshold;
        description = t(progressKey, { count, label, remaining: Math.max(nextThreshold - count, 0) });
      }
    } else if (tierIsEarned) {
      description = buildEarnedText(word, label);
    } else {
      description = t(unlockKey, { count, label, remaining: Math.max(threshold - count, 0), tier: word });
    }

    return { tier: tierName, image: tierImages[tierName], title: titleFor(word, label), description, earned: tierIsEarned };
  });

  const active = tierOptions[activeIndex];

  return {
    image,
    label: displayLabel,
    filledDots: currentTierIndex + 1,
    totalDots: tierOrder.length,
    earned,
    detail: {
      image: active.image,
      title: active.title,
      description: active.description,
      earned: active.earned,
      tiers: tierOptions,
      initialTierIndex: activeIndex,
    } as BadgeDetailData,
  };
}

const VOLUME_PROGRESS_KEY = "You've watched {{count}} {{label}}. Watch {{remaining}} more to level up!";
const VOLUME_UNLOCK_KEY = "You've watched {{count}} {{label}}. Watch {{remaining}} more to unlock {{tier}}!";
const ACTIVITY_PROGRESS_KEY = "You have {{count}} {{label}}. {{remaining}} more to level up!";
const ACTIVITY_UNLOCK_KEY = "You have {{count}} {{label}}. {{remaining}} more to unlock {{tier}}!";

// Long enough that switching between tabs a few times in a row doesn't
// refire this on every switch, short enough that coming back from actually
// earning something (the real bug this exists for) always sees it fresh.
const REVALIDATE_TTL_MS = 5_000;

interface Props {
  // Same "stays mounted once visited, revalidate silently on refocus"
  // shape ProfileSharingsTab.tsx's own `active` prop already established —
  // this tab needed the identical fix for the identical reason: a real
  // bug, reported live, where earning a badge and tapping "Tap to see your
  // badge" (BadgeEarnedModal.tsx) landed back on this already-mounted tab
  // still showing the stale, pre-earn (gray) state, because nothing ever
  // told it to fetch again after its first visit.
  active?: boolean;
  // `active` alone isn't enough: it only flips when the CATEGORY changes,
  // but "Tap to see your badge" often lands back on a tab that was already
  // "badges" from earlier in the session (the user had just been checking
  // it) — no category change means `active` never toggles, so an effect
  // keyed on `active` alone never re-fires. `screenFocused` (threaded down
  // from profile/index.tsx's own useFocusEffect) genuinely does toggle
  // false→true across leaving Profile and coming back, regardless of
  // which category was already selected — combining the two is what
  // actually catches this specific real-world path.
  screenFocused?: boolean;
  // When set, this is the public-profile Badges tab for that user instead
  // of the viewer's own — everything below renders identically either way
  // (same tiles, same tap-to-open detail popup), only `load()` changes:
  // one bulk `getAllBadgesForUser` request instead of the 20 separate
  // own-profile calls (see badgeService.ts's own comment on why that's a
  // dedicated endpoint). PublicProfileCategoryTabs passes this straight
  // through; there is no own-profile behavior change when omitted.
  userId?: string;
}

// Three badge shapes share this one tab: genre badges (2-tier, shown as
// separate always-visible tiles — a "collection" metaphor, since a higher
// tier earned doesn't retire the lower one from view, same as real trophy
// cabinets), volume badges (5-tier, one slot per category with a
// level-dot indicator — a "rank/ladder" metaphor), and the 3 activity
// ladders (rating/review/list counts, same "rank/ladder" metaphor as
// volume, just their own independent single-metric ladders with their own
// tier counts and rank words). All fetch independently and all feed the
// same BadgeDetailModal, just building different title/description
// strings for it via the shared buildLadderTile helper above.
function ProfileBadgesTab({ active = true, screenFocused = true, userId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [genreBadgesByKey, setGenreBadgesByKey] = useState<Record<string, GenreBadge> | null>(null);
  const [thresholds, setThresholds] = useState({ devotee: 15, master: 40 });
  const [volumeBadgesByKey, setVolumeBadgesByKey] = useState<Record<string, VolumeBadge> | null>(null);
  const [volumeTiers, setVolumeTiers] = useState<{ tier: VolumeTier; threshold: number }[]>([]);
  const [activityData, setActivityData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [socialData, setSocialData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [syncData, setSyncData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [seasonalData, setSeasonalData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [specialData, setSpecialData] = useState<Record<string, ActivityBadgeResponse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState<BadgeDetailData | null>(null);
  const lastFetchedRef = useRef(0);

  // Shared by both fetch paths below — same 8 setState calls regardless of
  // whether the 20 fields came from 20 own-profile requests or one bulk
  // public-profile response.
  const applyResults = useCallback(
    (
      genreRes: GenreBadgesResponse,
      volumeRes: VolumeBadgesResponse,
      ratingRes: ActivityBadgeResponse,
      reviewRes: ActivityBadgeResponse,
      listRes: ActivityBadgeResponse,
      followersRes: ActivityBadgeResponse,
      influencerRes: ActivityBadgeResponse,
      podiumRes: ActivityBadgeResponse,
      firstSyncRes: ActivityBadgeResponse,
      highMatchRes: ActivityBadgeResponse,
      syncExplorerRes: ActivityBadgeResponse,
      foundingRes: ActivityBadgeResponse,
      membershipRes: ActivityBadgeResponse,
      streakRes: ActivityBadgeResponse,
      timeTravelerRes: ActivityBadgeResponse,
      eclecticTasteRes: ActivityBadgeResponse,
      dayOneViewerRes: ActivityBadgeResponse,
      hiddenGemRes: ActivityBadgeResponse,
      pollParticipantRes: ActivityBadgeResponse,
      halloweenViewerRes: ActivityBadgeResponse,
      newYearViewerRes: ActivityBadgeResponse
    ) => {
      const genreMap: Record<string, GenreBadge> = {};
      genreRes.badges.forEach((b) => {
        genreMap[b.key] = b;
      });
      setGenreBadgesByKey(genreMap);
      setThresholds({ devotee: genreRes.devoteeThreshold, master: genreRes.masterThreshold });

      const volumeMap: Record<string, VolumeBadge> = {};
      volumeRes.badges.forEach((b) => {
        volumeMap[b.key] = b;
      });
      setVolumeBadgesByKey(volumeMap);
      setVolumeTiers(volumeRes.tiers);

      setActivityData({ ratingCount: ratingRes, reviewCount: reviewRes, listCount: listRes });
      setSocialData({ followers: followersRes, influencer: influencerRes, podium: podiumRes });
      setSyncData({ firstSync: firstSyncRes, highMatch: highMatchRes, syncExplorer: syncExplorerRes });
      setLoyaltyData({ founding: foundingRes, membership: membershipRes, streak: streakRes });
      setSeasonalData({ halloweenViewer: halloweenViewerRes, newYearViewer: newYearViewerRes });
      setSpecialData({
        timeTraveler: timeTravelerRes,
        eclecticTaste: eclecticTasteRes,
        dayOneViewer: dayOneViewerRes,
        hiddenGem: hiddenGemRes,
        pollParticipant: pollParticipantRes,
      });

      lastFetchedRef.current = Date.now();
    },
    []
  );

  const load = useCallback(
    (withSpinner: boolean) => {
      let cancelled = false;
      if (withSpinner) setLoading(true);

      const request = userId
        ? getAllBadgesForUser(userId).then((res) => {
            // Defensive only — PublicProfileCategoryTabs' own caller
            // (app/user/[id]/index.tsx) already gates the whole screen on
            // profile.isAuthorized before this tab can ever mount, so this
            // branch isn't expected to be reached in practice.
            if (!res.authorized) return null;
            return [
              res.genre,
              res.volume,
              res.ratingCount,
              res.reviewCount,
              res.listCount,
              res.followers,
              res.influencer,
              res.podium,
              res.firstSync,
              res.highMatch,
              res.syncExplorer,
              res.founding,
              res.membership,
              res.streak,
              res.timeTraveler,
              res.eclecticTaste,
              res.dayOneViewer,
              res.hiddenGem,
              res.pollParticipant,
              res.halloweenViewer,
              res.newYearViewer,
            ] as const;
          })
        : Promise.all([
            getGenreBadges(),
            getVolumeBadges(),
            getRatingCountBadge(),
            getReviewCountBadge(),
            getListCountBadge(),
            getFollowersBadge(),
            getInfluencerBadge(),
            getPodiumBadge(),
            getFirstSyncBadge(),
            getHighMatchBadge(),
            getSyncExplorerBadge(),
            getFoundingCinephileBadge(),
            getMembershipBadge(),
            getStreakBadge(),
            getTimeTravelerBadge(),
            getEclecticTasteBadge(),
            getDayOneViewerBadge(),
            getHiddenGemBadge(),
            getPollParticipantBadge(),
            getHalloweenViewerBadge(),
            getNewYearViewerBadge(),
          ] as const);

      request
        .then((results) => {
          if (cancelled || !results) return;
          applyResults(...results);
        })
        .finally(() => {
          if (!cancelled && withSpinner) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [userId, applyResults]
  );

  useEffect(() => load(true), [load]);

  // This tab stays mounted once visited (ProfileCategoryTabs keeps every
  // category alive so switching back is instant) — without this, the one
  // fetch above is the only one for the whole session, and a badge earned
  // after this tab's first visit would never show as unlocked. Silent
  // (no spinner, no cleared grid) since there's already something correct
  // on screen to keep showing while the request runs. Keyed on the
  // COMBINED signal (both true), not `active` alone — see Props' own
  // comment on `screenFocused` for why `active` by itself misses the
  // exact real-world path this exists to fix.
  const isVisible = active && screenFocused;
  useEffect(() => {
    if (!isVisible) return;
    if (Date.now() - lastFetchedRef.current < REVALIDATE_TTL_MS) return;
    return load(false);
  }, [isVisible, load]);

  const tileWidth = (screenWidth - CONTAINER_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const devoteeWord = t("Devotee");
  const masterWord = t("Master");

  const genreTiles = useMemo(() => {
    return GENRE_BADGE_DEFINITIONS.flatMap((def) => {
      const badge = genreBadgesByKey?.[def.key];
      const count = badge?.count ?? 0;
      const tier = badge?.tier ?? null;
      return [
        {
          id: `${def.key}_devotee`,
          image: def.devotee,
          label: `${def.label} ${devoteeWord}`,
          earned: tier === "devotee" || tier === "master",
          detail: {
            image: def.devotee,
            title: `${def.label} ${devoteeWord}`,
            description: t("I earned a new badge by watching {{count}} {{genre}} titles!", {
              count: thresholds.devotee,
              genre: def.label,
            }),
            earned: tier === "devotee" || tier === "master",
          } as BadgeDetailData,
        },
        {
          id: `${def.key}_master`,
          image: def.master,
          label: `${def.label} ${masterWord}`,
          earned: tier === "master",
          detail: {
            image: def.master,
            title: `${def.label} ${masterWord}`,
            description: t("I earned a new badge by watching {{count}} {{genre}} titles!", {
              count: thresholds.master,
              genre: def.label,
            }),
            earned: tier === "master",
          } as BadgeDetailData,
        },
      ];
    });
  }, [genreBadgesByKey, thresholds, devoteeWord, masterWord, t]);

  const volumeTiles = useMemo(() => {
    return VOLUME_BADGE_DEFINITIONS.map((def) => {
      const badge = volumeBadgesByKey?.[def.key];
      const built = buildLadderTile(t, {
        count: badge?.count ?? 0,
        tier: badge?.tier ?? null,
        tierOrder: VOLUME_TIER_ORDER,
        tierImages: def.tiers,
        tierThresholds: volumeTiers,
        tierWord: (tier) => t(VOLUME_TIER_LABEL_KEY[tier as VolumeTier]),
        label: t(def.label),
        progressKey: VOLUME_PROGRESS_KEY,
        unlockKey: VOLUME_UNLOCK_KEY,
      });
      return { id: def.key, ...built };
    });
  }, [volumeBadgesByKey, volumeTiers, t]);

  const activityTiles = useMemo(() => {
    return ACTIVITY_BADGE_DEFINITIONS.map((def) => {
      const res = activityData?.[def.family];
      const badge = res?.badges[0];
      const built = buildLadderTile(t, {
        count: badge?.count ?? 0,
        tier: badge?.tier ?? null,
        tierOrder: ACTIVITY_TIER_ORDER[def.family],
        tierImages: def.tierImages as Record<string, number>,
        tierThresholds: res?.tiers ?? [],
        tierWord: (tier) => t(def.tierLabelKeys[tier as keyof typeof def.tierLabelKeys]!),
        label: t(def.label),
        progressKey: ACTIVITY_PROGRESS_KEY,
        unlockKey: ACTIVITY_UNLOCK_KEY,
      });
      return { id: def.family, ...built };
    });
  }, [activityData, t]);

  const socialTiles = useMemo(() => {
    return SOCIAL_BADGE_DEFINITIONS.map((def) => {
      const res = socialData?.[def.family];
      const badge = res?.badges[0];
      const built = buildLadderTile(t, {
        count: badge?.count ?? 0,
        tier: badge?.tier ?? null,
        tierOrder: SOCIAL_TIER_ORDER[def.family],
        tierImages: def.tierImages as Record<string, number>,
        tierThresholds: res?.tiers ?? [],
        tierWord: (tier) => t(def.tierLabelKeys[tier as keyof typeof def.tierLabelKeys]!),
        label: t(def.label),
        progressKey: ACTIVITY_PROGRESS_KEY,
        unlockKey: ACTIVITY_UNLOCK_KEY,
      });
      return { id: def.family, ...built };
    });
  }, [socialData, t]);

  // One-off (not tiered) badges, direct ask ("ilk sync, yüksek eşleşme,
  // sync kaşifi" — no "(N kademe)" given, unlike every family above) — a
  // single image, earned or not, no level-dot strip to browse. Built by
  // hand rather than through buildLadderTile (which exists specifically
  // for the tier-strip popup a real ladder needs) since there's nothing
  // to browse here — same "own inline construction" precedent genreTiles
  // above already sets for a badge shape that doesn't fit the shared
  // ladder helper.
  const syncTiles = useMemo(() => {
    return SYNC_BADGE_DEFINITIONS.map((def) => {
      const res = syncData?.[def.family];
      const badge = res?.badges[0];
      const count = badge?.count ?? 0;
      const earned = badge?.tier != null;
      const threshold = res?.tiers[0]?.threshold ?? 0;
      const title = t(def.titleKey);

      let description: string;
      if (def.family === "firstSync") {
        description = earned
          ? t("You've completed your first Sync analysis!")
          : t("Run your first Sync analysis with someone to earn this badge!");
      } else if (def.family === "highMatch") {
        description = earned
          ? t("You reached a {{count}}% match with someone — an incredible connection!", { count })
          : t("Reach an {{threshold}}%+ match with someone to earn this badge!", { threshold });
      } else {
        description = earned
          ? t("You've run Sync analyses with {{count}} different people!", { count })
          : t("You've synced with {{count}} people so far — sync with {{remaining}} more to earn this badge!", {
              count,
              remaining: Math.max(threshold - count, 0),
            });
      }

      return {
        id: def.family,
        image: def.image,
        label: title,
        earned,
        detail: { image: def.image, title, description, earned } as BadgeDetailData,
      };
    });
  }, [syncData, t]);

  // Founding Cinephile — one-off, same shape as the sync tiles above.
  // `count` (the user's own registration rank) is intentionally never
  // shown — the sentence states the fixed cutoff instead, not "you were
  // #6," to keep the copy simple and avoid needing ordinal-number
  // formatting (1st/2nd/3rd/...), which isn't consistent across the app's
  // 12 locales.
  const foundingTile = useMemo(() => {
    const res = loyaltyData?.founding;
    const badge = res?.badges[0];
    const earned = badge?.tier != null;
    const cutoff = res?.tiers[0]?.threshold ?? 0;
    const title = t(FOUNDING_CINEPHILE_DEFINITION.titleKey);
    const description = earned
      ? t("You're one of Cinephix's first {{count}} members!", { count: cutoff })
      : t("Only Cinephix's first {{count}} members earn this badge!", { count: cutoff });
    return {
      id: "founding",
      image: FOUNDING_CINEPHILE_DEFINITION.image,
      label: title,
      earned,
      detail: { image: FOUNDING_CINEPHILE_DEFINITION.image, title, description, earned } as BadgeDetailData,
    };
  }, [loyaltyData, t]);

  const membershipTile = useMemo(() => {
    const res = loyaltyData?.membership;
    const badge = res?.badges[0];
    const built = buildLadderTile(t, {
      count: badge?.count ?? 0,
      tier: badge?.tier ?? null,
      tierOrder: MEMBERSHIP_TIER_ORDER,
      tierImages: MEMBERSHIP_BADGE_DEFINITION.tierImages,
      tierThresholds: res?.tiers ?? [],
      tierWord: (tier) => t(MEMBERSHIP_BADGE_DEFINITION.tierLabelKeys[tier as keyof typeof MEMBERSHIP_BADGE_DEFINITION.tierLabelKeys]),
      label: t(MEMBERSHIP_BADGE_DEFINITION.label),
      displayLabel: t("Membership"),
      progressKey: ACTIVITY_PROGRESS_KEY,
      unlockKey: ACTIVITY_UNLOCK_KEY,
    });
    return { id: "membership", ...built };
  }, [loyaltyData, t]);

  // Streak — the tier "word" is built directly from the tier's own real
  // day-count threshold via one shared template, not a per-tier
  // translated rank name (see loyaltyBadgeDefinitions.ts's own comment on
  // why) — which is also why this is the one ladder that overrides
  // titleFor/buildEarnedText/buildMaxedText: "7-Day Streak" is already a
  // complete phrase, appending "Days" after it the way every other ladder
  // wants would read wrong.
  const streakTile = useMemo(() => {
    const res = loyaltyData?.streak;
    const badge = res?.badges[0];
    const tiers = res?.tiers ?? [];
    const streakWord = (tier: string) => t("{{days}}-Day Streak", { days: tiers.find((v) => v.tier === tier)?.threshold ?? 0 });
    const built = buildLadderTile(t, {
      count: badge?.count ?? 0,
      tier: badge?.tier ?? null,
      tierOrder: STREAK_TIER_ORDER,
      tierImages: STREAK_BADGE_DEFINITION.tierImages,
      tierThresholds: tiers,
      tierWord: streakWord,
      label: t(STREAK_BADGE_DEFINITION.label),
      displayLabel: t("Streak"),
      progressKey: ACTIVITY_PROGRESS_KEY,
      unlockKey: ACTIVITY_UNLOCK_KEY,
      titleFor: (word) => word,
      buildEarnedText: (word) => t("You've earned the {{tier}} badge!", { tier: word }),
      buildMaxedText: (word) => t("You're a true cinephile! You've earned the {{tier}} badge — the highest tier!", { tier: word }),
    });
    return { id: "streak", ...built };
  }, [loyaltyData, t]);

  // Seasonal + special badges — 7 more one-off badges, same shape as the
  // sync/founding ones above (single image, no ladder). Eclectic Taste is
  // the one with a genuinely meaningful `count`/`remaining` (distinct
  // genres out of the real threshold the backend reports), everything
  // else here is a plain boolean earned/locked pair.
  const seasonalTiles = useMemo(() => {
    return SEASONAL_BADGE_DEFINITIONS.map((def) => {
      const res = seasonalData?.[def.family];
      const badge = res?.badges[0];
      const earned = badge?.tier != null;
      const title = t(def.titleKey);
      let description: string;
      if (def.family === "halloweenViewer") {
        description = earned
          ? t("You watched a Horror movie in October — spooky season done right!")
          : t("Add a Horror movie to your Watched List in October to earn this badge!");
      } else {
        description = earned
          ? t("You watched something right as the New Year arrived!")
          : t("Add something to your Watched List on New Year's Eve or Day to earn this badge!");
      }
      return {
        id: def.family,
        image: def.image,
        label: title,
        earned,
        detail: { image: def.image, title, description, earned } as BadgeDetailData,
      };
    });
  }, [seasonalData, t]);

  const specialTiles = useMemo(() => {
    return SPECIAL_BADGE_DEFINITIONS.map((def) => {
      const res = specialData?.[def.family];
      const badge = res?.badges[0];
      const count = badge?.count ?? 0;
      const earned = badge?.tier != null;
      const threshold = res?.tiers[0]?.threshold ?? 0;
      const title = t(def.titleKey);

      let description: string;
      switch (def.family) {
        case "timeTraveler":
          description = earned
            ? t("You watched something from before 1970 — a true classic!")
            : t("Watch something released before 1970 to earn this badge!");
          break;
        case "eclecticTaste":
          description = earned
            ? t("You've explored {{count}} different genres — your taste knows no bounds!", { count })
            : t("You've explored {{count}} different genres. Explore {{remaining}} more to earn this badge!", {
                count,
                remaining: Math.max(threshold - count, 0),
              });
          break;
        case "dayOneViewer":
          description = earned
            ? t("You watched something the very day it came out!")
            : t("Watch something on its release day to earn this badge!");
          break;
        case "hiddenGem":
          description = earned
            ? t("You rated a title highly that almost nobody else has watched — a true hidden gem!")
            : t("Rate a title 8+ that few others have watched to earn this badge!");
          break;
        default:
          description = earned ? t("You voted in a Cinephix poll!") : t("Vote in a Cinephix poll to earn this badge!");
      }

      return {
        id: def.family,
        image: def.image,
        label: title,
        earned,
        detail: { image: def.image, title, description, earned } as BadgeDetailData,
      };
    });
  }, [specialData, t]);

  const styles = useMemo(() => buildStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // One flat grid, no per-category headings — direct ask ("başlık başlık
  // dizmemize gerek yok... hepsini grid style olarak koy"). Every family's
  // own tile-building logic above is untouched; this just stopped
  // separating their output into labeled sections. Ladder tiles
  // (volume/activity/social/membership/streak) and plain one-off tiles
  // (genre/sync/founding/seasonal/special) render side by side in the
  // same `styles.grid` container — multiple `.map()` calls (and bare
  // elements for the loyalty tiles built individually, not as an array)
  // as adjacent children of one View is valid JSX, no wrapping Fragment
  // needed.
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {volumeTiles.map((tile) => (
          <LadderTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            filledDots={tile.filledDots}
            totalDots={tile.totalDots}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        {activityTiles.map((tile) => (
          <LadderTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            filledDots={tile.filledDots}
            totalDots={tile.totalDots}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        {socialTiles.map((tile) => (
          <LadderTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            filledDots={tile.filledDots}
            totalDots={tile.totalDots}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        {syncTiles.map((tile) => (
          <BadgeTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        <BadgeTile
          width={tileWidth}
          image={foundingTile.image}
          label={foundingTile.label}
          earned={foundingTile.earned}
          onPress={() => setSelectedTile(foundingTile.detail)}
        />
        <LadderTile
          width={tileWidth}
          image={membershipTile.image}
          label={membershipTile.label}
          filledDots={membershipTile.filledDots}
          totalDots={membershipTile.totalDots}
          earned={membershipTile.earned}
          onPress={() => setSelectedTile(membershipTile.detail)}
        />
        <LadderTile
          width={tileWidth}
          image={streakTile.image}
          label={streakTile.label}
          filledDots={streakTile.filledDots}
          totalDots={streakTile.totalDots}
          earned={streakTile.earned}
          onPress={() => setSelectedTile(streakTile.detail)}
        />
        {seasonalTiles.map((tile) => (
          <BadgeTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        {specialTiles.map((tile) => (
          <BadgeTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
        {genreTiles.map((tile) => (
          <BadgeTile
            key={tile.id}
            width={tileWidth}
            image={tile.image}
            label={tile.label}
            earned={tile.earned}
            onPress={() => setSelectedTile(tile.detail)}
          />
        ))}
      </View>

      <BadgeDetailModal visible={!!selectedTile} onClose={() => setSelectedTile(null)} badge={selectedTile} />
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { paddingHorizontal: CONTAINER_PADDING, paddingTop: 12, paddingBottom: 24 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
    loadingWrap: { paddingVertical: 40, alignItems: "center" },
  });
}

function buildTileStyles(colors: ColorPalette) {
  return StyleSheet.create({
    tile: { alignItems: "center", backgroundColor: colors.base200, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6 },
    imageWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    image: { width: 44, height: 44 },
    label: {
      fontFamily: fonts.bold,
      fontSize: 9.5,
      lineHeight: 12,
      textAlign: "center",
      color: colors.baseContent,
      marginTop: 6,
    },
    dotsRow: { flexDirection: "row", gap: 3, marginTop: 6 },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
  });
}

export default memo(ProfileBadgesTab);
