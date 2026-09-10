import { useCallback, useState, useMemo } from "react";
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { useChat } from "../../../src/context/ChatContext";
import { useToast } from "../../../src/context/ToastContext";
import { useFollowState } from "../../../src/hooks/useFollowState";
import {
  fetchPublicProfile,
  fetchPublicProfileCollections,
  getCachedCollections,
  getCachedPublicProfile,
  invalidatePublicProfile,
  type PublicProfileBundle,
} from "../../../src/api/publicProfileCache";
import { sameShape } from "../../../src/utils/cache";
import { getOrCreateConversation, sendRichMessage } from "../../../src/api/conversationService";
import ProfileHeaderInstagram from "../../../src/components/profile/ProfileHeaderInstagram";
import type { PhotoViewerAction } from "../../../src/components/profile/ProfilePhotoViewerModal";
import PublicProfileCategoryTabs from "../../../src/components/profile/PublicProfileCategoryTabs";
import UserSharePickerModal from "../../../src/components/UserSharePickerModal";
import { SkeletonProfileHeader } from "../../../src/components/Skeleton";
import type { CineGraphData, Favorites, FollowStatus, PublicProfile } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function PublicProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base100 },
  scrollContent: { flexGrow: 1 },
  container: {
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.base100,
    flexGrow: 1,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.bold, fontSize: 28, color: colors.primary },
  username: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent, marginTop: 12 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  lockText: { color: colors.placeholder, fontSize: 14, textAlign: "center" },
  // Follow and Message share one row, each taking half of it — the Follow
  // pill used to stretch alone across the full width.
  actionRow: { flexDirection: "row", alignSelf: "stretch", gap: 8, marginTop: 20 },
  actionButton: { flex: 1 },
  // Mirrors FollowButton.tsx's own pill styling exactly — inlined here
  // (rather than using that shared component) so this screen's one
  // useFollowState instance can also drive the photo-viewer modal's Follow
  // action without a second, independently-seeded instance silently
  // drifting out of sync with this one.
  followPill: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
  },
  followPillOutline: { borderWidth: 1, borderColor: colors.border },
  followPillPrimary: { backgroundColor: colors.primary },
  followPillText: { fontFamily: fonts.bold, fontSize: 14 },
  followPillTextOutline: { color: colors.baseContent },
  followPillTextPrimary: { color: colors.primaryContent },
  error: { color: colors.error, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();
  const [sharePickerVisible, setSharePickerVisible] = useState(false);
  const [sharingProfile, setSharingProfile] = useState(false);

  // Seeded from the cache at mount, not left null and filled in by an
  // effect — a profile opened before is on screen in the first frame.
  const cachedBundle = id ? getCachedPublicProfile(id) : undefined;
  const [profile, setProfile] = useState<PublicProfile | null>(cachedBundle?.profile ?? null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(cachedBundle?.cineGraph ?? null);
  const [favorites, setFavorites] = useState<Favorites | null>(cachedBundle?.favorites ?? null);
  const [shareCount, setShareCount] = useState<number | undefined>(cachedBundle?.shareCount);
  const [shares, setShares] = useState(cachedBundle?.shares);
  const [collections, setCollections] = useState(id ? getCachedCollections(id) : undefined);
  // Whether `profile` came from the network this session rather than the
  // cache — see initialFollowStatus below for why that distinction matters.
  const [profileIsFresh, setProfileIsFresh] = useState(false);
  const [loading, setLoading] = useState(!cachedBundle);
  const [error, setError] = useState<string | null>(null);

  // Computed here (not after the early returns below) since hooks must run
  // unconditionally on every render — undefined while profile hasn't
  // loaded yet just means useFollowState falls back to its own
  // graph-derived default until the real value is known.
  //
  // Deliberately NOT derived from the cached copy. useFollowState treats a
  // defined initialStatus as authoritative and stops tracking the shared
  // follow graph, so seeding it from a cached followers array would pin the
  // button to whatever was true last visit — wrong if you followed this
  // person from somewhere else in the app since. Unseeded, it reads the
  // graph, which is always current; the fresh fetch below then supplies a
  // real seed for anyone mounting after it.
  const initialFollowStatus: FollowStatus | undefined = !profile || !profileIsFresh
    ? undefined
    : profile.isAuthorized
      ? profile.followers.includes(user?._id ?? "")
        ? "following"
        : profile.isRequested
          ? "requested"
          : "not-following"
      : profile.isRequested
        ? "requested"
        : "not-following";

  // Lifted to the page (rather than each usage owning its own
  // useFollowState instance via <FollowButton>) so the always-visible
  // Follow pill and the photo-viewer modal's Follow action share one
  // source of truth — two independently-seeded instances for the same
  // target can silently disagree with each other (seeded instances never
  // re-sync from the shared follow graph once mounted).
  const {
    status: followStatus,
    pending: followPending,
    follow: followUser,
    unfollow: unfollowUser,
  } = useFollowState(id ?? "", { initialStatus: initialFollowStatus });

  // Revalidates on every focus, but never tears the screen down to do it.
  //
  // This used to flip `loading` true on each focus, which swapped the whole
  // tree for the skeleton below — unmounting the category tabs and taking
  // with them the selected tab, the movie/series switcher and the donut's
  // focused genre. That's why coming back from a genre's detail page landed
  // on Sharings instead of the CineGraph you opened it from. The skeleton is
  // now only for a genuinely cold load; a revisit renders the cached bundle
  // immediately and lets the fresh copy land underneath, so an item the
  // other person added since your last visit still shows up.
  useFocusEffect(
    useCallback(() => {
      if (!id || id === user?._id) return;
      let cancelled = false;

      const apply = (bundle: PublicProfileBundle) => {
        // Identity-preserving: an unchanged revalidation keeps the previous
        // objects so React bails out instead of re-deriving the donut's
        // geometry and every chip position from scratch.
        setProfile((prev) => (sameShape(prev, bundle.profile) ? prev : bundle.profile));
        setCineGraph((prev) => (sameShape(prev, bundle.cineGraph) ? prev : bundle.cineGraph));
        setFavorites((prev) => (sameShape(prev, bundle.favorites) ? prev : bundle.favorites));
        setShareCount(bundle.shareCount);
        setShares((prev) => (sameShape(prev, bundle.shares) ? prev : bundle.shares));
        navigation.setOptions({ title: bundle.profile.username });
      };

      const cached = getCachedPublicProfile(id);
      if (cached) {
        apply(cached);
        setLoading(false);
      }

      // Awaited separately from the bundle, so the header and Sharings grid
      // never wait on the Lists tab's data. Lands quietly behind them.
      fetchPublicProfileCollections(id)
        .then((result) => {
          if (!cancelled) setCollections((prev) => (sameShape(prev, result) ? prev : result));
        })
        .catch(() => {
          // The tab shows its own empty rails; nothing else on the page
          // depends on this.
        });

      setError(null);
      fetchPublicProfile(id)
        .then((bundle) => {
          if (cancelled) return;
          apply(bundle);
          setProfileIsFresh(true);
        })
        .catch((e: any) => {
          // A failed background revalidation leaves the cached copy on
          // screen — stale-but-working beats an error page replacing
          // content that was fine a second ago. Only a cold load surfaces.
          if (!cancelled && !cached) setError(e?.response?.data?.message || t("Failed to load profile."));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [id, user?._id])
  );

  if (id && id === user?._id) {
    return <Redirect href="/profile" />;
  }

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SkeletonProfileHeader statCount={3} tabCount={3} />
      </ScrollView>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t("Profile not found.")}</Text>
      </View>
    );
  }

  const followLabel =
    followStatus === "following" ? t("Following") : followStatus === "requested" ? t("Requested") : t("Follow");
  const followOutline = followStatus === "following" || followStatus === "requested";
  // Following a private account flips what their profile is even allowed to
  // return, and either direction changes their follower list — so the cached
  // bundle is now definitively wrong rather than merely old. Dropping it and
  // refetching keeps the next focus (and the tabs already on screen) honest.
  const handleFollowPress = async () => {
    await (followStatus === "not-following" ? followUser() : unfollowUser());
    if (!id) return;
    invalidatePublicProfile(id);
    fetchPublicProfile(id)
      .then((bundle) => {
        setProfile((prev) => (sameShape(prev, bundle.profile) ? prev : bundle.profile));
        setCineGraph((prev) => (sameShape(prev, bundle.cineGraph) ? prev : bundle.cineGraph));
        setFavorites((prev) => (sameShape(prev, bundle.favorites) ? prev : bundle.favorites));
        setShareCount(bundle.shareCount);
        setShares((prev) => (sameShape(prev, bundle.shares) ? prev : bundle.shares));
      })
      .catch(() => {
        // The follow itself already succeeded and useFollowState has updated
        // the button — a failed refetch just means the rest of the page
        // catches up on the next focus.
      });
  };

  // Straight navigation, nothing awaited. Finding-or-creating the
  // conversation is a real round trip, and doing it here meant the button
  // sat spinning on the profile for its whole duration before anything
  // moved. The chat route is keyed by this person rather than by a
  // conversation id (app/user/[id]/chat.tsx), so it can open immediately —
  // already showing their name — and resolve the conversation itself.
  const handleMessagePress = () => {
    router.push({
      pathname: "/user/[id]/chat",
      params: {
        id,
        // So the chat header reads the right name from the first frame
        // instead of "Conversation" until the conversation list resolves.
        otherUsername: profile.username,
        otherAvatar: profile.profile_pic_url ?? "",
      },
    });
  };

  const actionRow = (
    <View style={styles.actionRow}>
      <Pressable
        style={[styles.actionButton, styles.followPill, followOutline ? styles.followPillOutline : styles.followPillPrimary]}
        onPress={handleFollowPress}
        disabled={followPending}
      >
        {followPending ? (
          <ActivityIndicator color={followOutline ? colors.baseContent : colors.primaryContent} />
        ) : (
          <Text style={[styles.followPillText, followOutline ? styles.followPillTextOutline : styles.followPillTextPrimary]}>
            {followLabel}
          </Text>
        )}
      </Pressable>

      {/* Your own profile never reaches this screen — it redirects to
          /profile above — so there's no self-message case to guard. */}
      <Pressable
        style={[styles.actionButton, styles.followPill, styles.followPillOutline]}
        onPress={handleMessagePress}
      >
        <Text style={[styles.followPillText, styles.followPillTextOutline]}>{t("Message")}</Text>
      </Pressable>
    </View>
  );

  // A private account you don't follow has nothing to show — this stays a
  // single simple centered view, distinct from the full Instagram-style
  // layout below (no bio/stats/categories to show either way). Checked
  // before the photo-viewer/share-profile setup below so TS narrows
  // `profile` to the full (non-masked) shape for the rest of the function —
  // the masked branch has no accountTier/etc. to build those from anyway.
  if (!profile.isAuthorized) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {profile.profile_pic_url ? (
          <Image source={{ uri: profile.profile_pic_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.username}>{profile.username}</Text>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={16} color={colors.placeholder} />
          <Text style={styles.lockText}>{t("This account is private.")}</Text>
        </View>
        {actionRow}
      </ScrollView>
    );
  }

  // In-app share to a friend ("hey, do you know this person?") rather than
  // the OS share sheet — reuses the same recipient-picker + rich-message
  // pattern ProfileAnalysisModal/MatchCoverCard already use for
  // analysis_share, just with a new "profile_share" message type. No
  // allowGroups here (matches ProfileAnalysisModal's own plain
  // users-only picker) — sharing a person is a 1:1 "hey" gesture, not
  // something aimed at a whole community.
  const handleShareProfile = () => setSharePickerVisible(true);

  const handleConfirmShareRecipients = async (userIds: string[]) => {
    setSharingProfile(true);
    try {
      const text = t("Check out {{username}}'s profile on Cinephix!", { username: profile.username });
      await Promise.all(
        userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, {
            text,
            type: "profile_share",
            profileData: {
              userId: profile._id,
              username: profile.username,
              profile_pic_url: profile.profile_pic_url,
              accountTier: profile.accountTier,
            },
          });
        })
      );
      await refreshConversations();
      setSharePickerVisible(false);
      showToast(t("Shared"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingProfile(false);
    }
  };

  const photoViewerActions: PhotoViewerAction[] = [
    {
      key: "follow",
      icon: followStatus === "following" ? "checkmark" : followStatus === "requested" ? "time-outline" : "person-add-outline",
      label: followLabel,
      active: followStatus === "following",
      loading: followPending,
      onPress: handleFollowPress,
    },
    {
      key: "share",
      icon: "share-social-outline",
      label: t("Share Profile"),
      onPress: handleShareProfile,
    },
  ];

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <ProfileHeaderInstagram
          profile={profile}
          targetUserId={id}
          shareCount={shareCount}
          actionsSlot={actionRow}
          photoViewerActions={photoViewerActions}
        />

        <PublicProfileCategoryTabs
          favorites={favorites}
          cineGraph={cineGraph}
          userId={id}
          initialShares={shares}
          collections={collections}
          initialCategory={tab === "favorites" ? "favorites" : undefined}
        />
      </ScrollView>

      <UserSharePickerModal
        visible={sharePickerVisible}
        title={t("Share Profile")}
        onClose={() => setSharePickerVisible(false)}
        sending={sharingProfile}
        onConfirm={handleConfirmShareRecipients}
      />
    </>
  );
}
