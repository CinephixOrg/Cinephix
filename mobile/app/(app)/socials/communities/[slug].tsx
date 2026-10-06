import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import Pressable from "../../../../src/components/common/TapSafePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../src/context/AuthContext";
import { useChat } from "../../../../src/context/ChatContext";
import { useToast } from "../../../../src/context/ToastContext";
import { useCommunity } from "../../../../src/hooks/useCommunities";
import { cachedMembers, refreshMembers, setMembership } from "../../../../src/api/communitiesStore";
import { getGroupChallenge, getGroupMessages, listWatchParties, markGroupRead, sendGroupMessageRest } from "../../../../src/api/groupService";
import ChatRoom from "../../../../src/components/ChatRoom";
import ConfirmDialog from "../../../../src/components/settings/ConfirmDialog";
import CommunityTags from "../../../../src/components/socials/CommunityTags";
import CommunityHubTab from "../../../../src/components/socials/CommunityHubTab";
import { AdminPanelModal, EditCommunityIdentityModal, EditFeedAnnouncementsModal } from "../../../../src/components/socials/CommunityAdminModals";
import { categoryTone, isDarkTheme, type CategoryTone } from "../../../../src/components/socials/communityCategory";
import { SkeletonGrid, SkeletonAvatarCell, SkeletonGroupDetailHeader } from "../../../../src/components/Skeleton";
import TierAvatarFrame from "../../../../src/components/TierAvatarFrame";
import { localeUpper } from "../../../../src/utils/text";
import type { Group, GroupChallenge, GroupMember, GroupWatchParty } from "../../../../src/types";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";
import { isWatchPartyLive } from "../../../../src/utils/watchParty";

const MEMBER_AVATAR_SIZE = 56;
// "About" is only ever reachable for a preset (owner-less) community — a
// partner community's own description/tags move into Overview instead
// (GroupDetailScreen's own `tabs` useMemo below), so showing both would be
// the exact duplication this redesign was asked to remove.
const BASE_TABS = ["Chat", "Members", "About"] as const;
type Tab = (typeof BASE_TABS)[number] | "Overview";

type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.base100 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: colors.base100 },
    // paddingTop is overridden inline with the device's own safe-area
    // inset — there's no native header anymore to reserve that space.
    hero: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
    heroRow: { flexDirection: "row", alignItems: "center", gap: 11 },
    backButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", marginLeft: -6 },
    tile: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    manageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.base200,
      marginRight: 2,
    },
    heroText: { flex: 1, minWidth: 0 },
    name: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 25, color: colors.baseContent, letterSpacing: -0.3 },
    meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    category: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9 },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.placeholder, opacity: 0.7 },
    count: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
    description: { fontSize: 14.5, lineHeight: 21.5, color: colors.baseContent, opacity: 0.86 },
    joinButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      minWidth: 92,
      height: 38,
      borderRadius: 19,
      paddingHorizontal: 14,
    },
    join: { backgroundColor: colors.primary },
    joined: { backgroundColor: colors.base200, borderWidth: 1, borderColor: colors.border },
    joinText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primaryContent },
    joinedText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
    tabs: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 3,
      borderRadius: 13,
      backgroundColor: colors.base200,
    },
    tabIndicator: {
      position: "absolute",
      top: 3,
      bottom: 3,
      left: 3,
      borderRadius: 10,
      backgroundColor: colors.base100,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    tab: { flex: 1, height: 34, alignItems: "center", justifyContent: "center" },
    tabText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.placeholder },
    tabTextActive: { fontFamily: fonts.bold, color: colors.baseContent },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    chatWrap: { flex: 1 },
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      backgroundColor: colors.base200,
    },
    liveBannerIcon: { color: colors.primary },
    liveBannerText: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.baseContent },
    membersList: { padding: 12 },
    memberCell: { width: "33.33%", alignItems: "center", paddingVertical: 12, paddingHorizontal: 6 },
    memberCellSelf: { opacity: 0.75 },
    memberAvatarFallback: { backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },
    memberAvatarFallbackText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
    memberUsername: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.baseContent, marginTop: 7, maxWidth: 96 },
    // Community-scoped only (see GroupMember.isFoundingMember's own
    // comment) — never the app-wide profile Badges tab.
    foundingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: `${colors.warning}1f`,
    },
    foundingBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.warning },
    // Shown instead of the Founding Member badge for this community's own
    // owner — direct ask, after nothing distinguished the admin from any
    // other member here ("admin ile diğerlerini ayıran bir şey yok").
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: `${colors.primary}1f`,
    },
    adminBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.primary },
    memberJoined: { fontSize: 10.5, color: colors.placeholder, marginTop: 2 },
    empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
    about: { padding: 16, gap: 18 },
    aboutLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, color: colors.placeholder, marginBottom: 8 },
    aboutText: { fontSize: 15.5, lineHeight: 23.5, color: colors.baseContent },
    aboutMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    aboutMetaText: { fontSize: 14, color: colors.baseContent },
    locked: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 40, gap: 10 },
    lockedIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    lockedTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent, textAlign: "center" },
    lockedText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
    lockedButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      height: 48,
      borderRadius: 24,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
    },
    retry: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.base200 },
    retryText: { fontFamily: fonts.bold, color: colors.baseContent },
  });
}

type Styles = ReturnType<typeof createStyles>;

/** Chat / Members / About (+ Community, for a partner community), with a pill that slides between them on the native driver. */
const Tabs = memo(function Tabs({ tab, tabs, onChange, styles }: { tab: Tab; tabs: readonly Tab[]; onChange: (tab: Tab) => void; styles: Styles }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(tabs.indexOf(tab))).current;
  const slot = width > 0 ? (width - 6) / tabs.length : 0;

  useEffect(() => {
    Animated.spring(position, { toValue: tabs.indexOf(tab), speed: 20, bounciness: 4, useNativeDriver: true }).start();
  }, [tab, tabs, position]);

  return (
    <View style={styles.tabs} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} accessibilityRole="tablist">
      {slot > 0 ? (
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: slot, transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, slot] }) }] },
          ]}
        />
      ) : null}
      {tabs.map((name) => (
        <Pressable
          key={name}
          style={styles.tab}
          onPress={() => onChange(name)}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === name }}
        >
          <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{t(name)}</Text>
        </Pressable>
      ))}
    </View>
  );
});

// A single compact, colored-border strip above Chat, surfacing whatever
// is most "live" right now — direct ask, with an explicit "don't flood it
// with notices" constraint, so this only ever shows ONE thing, picked by
// priority: a watch party actually happening right now > an active
// (non-expired) poll > an active (non-expired) challenge. Does its own
// small fetch for watch parties/challenge rather than sharing
// CommunityHubTab's internal state (group.pinnedPoll is already on the
// `group` prop this screen already has) — keeps the two components
// decoupled for a purely decorative summary, at the cost of one extra
// lightweight GET pair when Chat is open.
const LiveBanner = memo(function LiveBanner({ group, styles, onOpenOverview }: { group: Group; styles: Styles; onOpenOverview: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [watchParties, setWatchParties] = useState<{ upcoming: GroupWatchParty[]; past: GroupWatchParty[] } | undefined>(undefined);
  const [challenge, setChallenge] = useState<GroupChallenge | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    listWatchParties(group.slug)
      .then((r) => {
        if (!cancelled) setWatchParties(r);
      })
      .catch(() => {});
    getGroupChallenge(group.slug)
      .then((c) => {
        if (!cancelled) setChallenge(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [group.slug]);

  const liveParty = watchParties?.past.find(isWatchPartyLive);
  const activePoll = group.pinnedPoll && !group.pinnedPoll.isExpired ? group.pinnedPoll : null;
  const activeChallenge = challenge && !challenge.isExpired ? challenge : null;

  const item = liveParty
    ? { icon: "radio" as const, label: t("Live now: {{title}}", { title: liveParty.contentTitle }), onPress: () => router.push(`/socials/communities/${group.slug}/watch-party/${liveParty._id}` as never) }
    : activePoll
    ? { icon: "bar-chart" as const, label: activePoll.question || t("Community Poll"), onPress: onOpenOverview }
    : activeChallenge
    ? { icon: "trophy" as const, label: activeChallenge.title, onPress: onOpenOverview }
    : null;

  if (!item) return null;

  return (
    <Pressable style={styles.liveBanner} onPress={item.onPress}>
      <Ionicons name={item.icon} size={15} color={styles.liveBannerIcon.color} />
      <Text style={styles.liveBannerText} numberOfLines={1}>
        {item.label}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={styles.liveBannerIcon.color} />
    </Pressable>
  );
});

function MembershipButton({
  group,
  busy,
  onJoin,
  onLeave,
  styles,
  colors,
}: {
  group: Group;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const member = group.isMember;
  return (
    <Pressable
      onPress={member ? onLeave : onJoin}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={member ? t("Leave") : t("Join")}
      style={({ pressed }) => [styles.joinButton, member ? styles.joined : styles.join, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={member ? colors.baseContent : colors.primaryContent} />
      ) : (
        <>
          <Ionicons name={member ? "checkmark" : "add"} size={16} color={member ? colors.baseContent : colors.primaryContent} />
          <Text style={member ? styles.joinedText : styles.joinText}>{member ? t("Joined") : t("Join")}</Text>
        </>
      )}
    </Pressable>
  );
}

function MembersTab({ slug, ownerId, styles }: { slug: string; ownerId?: string; styles: Styles }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[] | undefined>(() => cachedMembers(slug));

  useEffect(() => {
    let cancelled = false;
    refreshMembers(slug)
      .then((items) => {
        if (!cancelled) setMembers(items);
      })
      .catch(() => {
        if (!cancelled) setMembers((current) => current ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // You first, then everyone else in join order.
  const ordered = useMemo(() => {
    if (!members) return undefined;
    const isMe = (m: GroupMember) => m.user._id === user?._id;
    return [...members.filter(isMe), ...members.filter((m) => !isMe(m))];
  }, [members, user?._id]);

  if (!ordered) {
    return (
      <View style={styles.membersList}>
        <SkeletonGrid count={9} columns={3} renderItem={() => <SkeletonAvatarCell />} />
      </View>
    );
  }

  return (
    <FlatList
      data={ordered}
      keyExtractor={(item) => item.user._id}
      numColumns={3}
      contentContainerStyle={styles.membersList}
      initialNumToRender={18}
      renderItem={({ item }) => {
        const isMe = item.user._id === user?._id;
        return (
          <Pressable
            style={({ pressed }) => [styles.memberCell, isMe && styles.memberCellSelf, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/user/${item.user._id}`)}
            disabled={isMe}
          >
            <TierAvatarFrame tier={item.user.accountTier} size={MEMBER_AVATAR_SIZE}>
              {(innerSize) =>
                item.user.profile_pic_url ? (
                  <Image
                    source={{ uri: item.user.profile_pic_url }}
                    style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
                  />
                ) : (
                  <View style={[styles.memberAvatarFallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                    <Text style={styles.memberAvatarFallbackText}>{item.user.username.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )
              }
            </TierAvatarFrame>
            <Text style={styles.memberUsername} numberOfLines={1}>
              {item.user.username}
              {isMe ? ` ${t("(you)")}` : ""}
            </Text>
            {item.user._id === ownerId ? (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={9} color={styles.adminBadgeText.color} />
                <Text style={styles.adminBadgeText}>{t("Admin")}</Text>
              </View>
            ) : item.isFoundingMember ? (
              <View style={styles.foundingBadge}>
                <Ionicons name="star" size={9} color={styles.foundingBadgeText.color} />
                <Text style={styles.foundingBadgeText}>{t("Founding Member")}</Text>
              </View>
            ) : null}
            <Text style={styles.memberJoined}>
              {t("Joined")} {new Date(item.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>{t("No members yet.")}</Text>}
    />
  );
}

function AboutTab({ group, tone, styles }: { group: Group; tone: CategoryTone; styles: Styles }) {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.about}>
      <View>
        <Text style={styles.aboutLabel}>{localeUpper(t("About"))}</Text>
        <Text style={styles.aboutText}>{group.description}</Text>
      </View>
      {group.tags.length > 0 ? (
        <View>
          <Text style={styles.aboutLabel}>{localeUpper(t("Topics"))}</Text>
          <CommunityTags tags={group.tags} tone={tone} size="regular" />
        </View>
      ) : null}
      <View style={styles.aboutMeta}>
        <Ionicons name="calendar-outline" size={16} color={styles.count.color} />
        <Text style={styles.aboutMetaText}>
          {t("Created")}{" "}
          {new Date(group.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>
    </ScrollView>
  );
}

// A community's own page — the one place to join or leave it. Opens from the
// list's cached copy, so the header is there on the first frame; the server's
// copy replaces it quietly when it lands.
export default function GroupDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { joinRoom, leaveRoom, markGroupReadLocally, refreshConversations } = useChat();
  const { group, failed, reload } = useCommunity(slug);
  const [tab, setTab] = useState<Tab>("Chat");
  const [busy, setBusy] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const dark = isDarkTheme(colors);
  const { user } = useAuth();
  const isOwner = !!user && group?.owner?._id === user._id;

  // Every admin-only action in one place (the gear icon next to the
  // compact header below), rather than scattered across Overview's own
  // content — direct ask. Lifted up here (not owned by CommunityHubTab)
  // since the gear icon itself lives in this screen's persistent header,
  // reachable from any tab.
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [editingFeedAnnouncements, setEditingFeedAnnouncements] = useState(false);

  // A partner community (group.owner set) opens on Overview, not Chat —
  // poll/challenge/watch-party/leaderboard are what makes it feel "alive,"
  // the content people actually come back to check, so it gets first
  // billing instead of being the 4th tab a viewer has to go find. Applied
  // once, the first moment `group` loads (not on every refetch), so it
  // never fights a viewer who's since switched tabs themselves.
  const appliedInitialTabRef = useRef(false);
  useEffect(() => {
    if (appliedInitialTabRef.current || !group) return;
    appliedInitialTabRef.current = true;
    if (group.owner) setTab("Overview");
  }, [group]);

  useLayoutEffect(() => {
    // No native header at all — direct report: the native title bar
    // showing the community's name sat directly above this screen's own
    // compact header (which repeats the name), reading as the same thing
    // twice. The back button moves into that compact header instead (see
    // the `hero` row below).
    navigation.setOptions({ headerShown: false });
  }, [navigation, group?.name]);

  // Refreshes on every return to this screen (not just on mount) — an
  // owner coming back from pinning a list, creating a poll/challenge, or
  // editing identity (all on separate screens/modals) needs this screen's
  // own cached copy to pick up what just changed.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // "Overview" leads for a partner community, replacing "About" entirely
  // (its content — description, tags, created date — moves into Overview's
  // own scroll instead) rather than sitting alongside it as a 4th,
  // redundant destination.
  const tabs = useMemo<readonly Tab[]>(() => (group?.owner ? ["Overview", "Chat", "Members"] : BASE_TABS), [group?.owner]);

  useEffect(() => {
    if (tab !== "Chat" || !group?.isMember) return;
    joinRoom("group", group._id);
    markGroupReadLocally(group._id);
    return () => leaveRoom("group", group._id);
  }, [tab, group?._id, group?.isMember, joinRoom, leaveRoom, markGroupReadLocally]);

  const changeMembership = useCallback(
    async (join: boolean) => {
      if (!group) return;
      setBusy(true);
      try {
        await setMembership(group.slug, join);
        // The inbox lists the communities you're in.
        refreshConversations();
      } catch (e: any) {
        showToast(e?.response?.data?.message || t("Action failed."));
      } finally {
        setBusy(false);
      }
    },
    [group, refreshConversations, showToast, t]
  );

  const leave = useCallback(() => {
    setConfirmingLeave(false);
    changeMembership(false);
  }, [changeMembership]);

  if (!group) {
    if (failed) {
      return (
        <View style={styles.center}>
          <Text style={styles.lockedText}>{t("Failed to load group.")}</Text>
          <Pressable style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]} onPress={reload}>
            <Text style={styles.retryText}>{t("Try again")}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <SkeletonGroupDetailHeader />
      </View>
    );
  }

  const tone = categoryTone(group.category, dark);
  const members = t(group.memberCount === 1 ? "{{count}} member" : "{{count}} members", { count: group.memberCount });

  const locked = (
    <View style={styles.locked}>
      <View style={[styles.lockedIcon, { backgroundColor: tone.tint }]}>
        <Ionicons name="chatbubbles-outline" size={32} color={tone.color} />
      </View>
      <Text style={styles.lockedTitle}>{t("Join the conversation")}</Text>
      <Text style={styles.lockedText}>{t("Join {{name}} to chat with its members.", { name: group.name })}</Text>
      <Pressable
        onPress={() => changeMembership(true)}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.lockedButton, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primaryContent} />
        ) : (
          <>
            <Ionicons name="add" size={18} color={colors.primaryContent} />
            <Text style={styles.joinText}>{t("Join community")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Compact on purpose — no description text here anymore (direct
          report: seeing the full bio under every single tab, Chat
          included, read as pointless repetition). The full
          description/tags/created-date now live in exactly one place:
          Overview's own scroll for a partner community, the About tab for
          a preset one (About no longer exists for a partner community at
          all — see the `tabs` useMemo above). */}
      <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <View style={styles.heroRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.baseContent} />
          </Pressable>
          <View style={[styles.tile, { backgroundColor: tone.tint }]}>
            {group.coverImage ? (
              <Image source={{ uri: group.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name={tone.icon} size={20} color={tone.color} />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.category, { color: tone.color }]}>{localeUpper(t(group.category))}</Text>
              <View style={styles.dot} />
              <Text style={styles.count}>{members}</Text>
            </View>
          </View>
          {isOwner ? (
            <Pressable style={styles.manageButton} onPress={() => setAdminPanelOpen(true)} hitSlop={8}>
              <Ionicons name="settings-outline" size={19} color={colors.baseContent} />
            </Pressable>
          ) : null}
          <MembershipButton
            group={group}
            busy={busy}
            onJoin={() => changeMembership(true)}
            onLeave={() => setConfirmingLeave(true)}
            styles={styles}
            colors={colors}
          />
        </View>
      </View>

      <Tabs tab={tab} tabs={tabs} onChange={setTab} styles={styles} />
      <View style={styles.divider} />

      {tab === "Chat" ? (
        <View style={styles.chatWrap}>
          {group.owner ? <LiveBanner group={group} styles={styles} onOpenOverview={() => setTab("Overview")} /> : null}
          <ChatRoom
            key={group._id}
            roomType="group"
            roomId={group._id}
            canChat={group.isMember}
            lockedContent={locked}
            emptyText={t("No messages yet. Start the conversation!")}
            fetchMessages={(before, limit) => getGroupMessages(group._id, before, limit)}
            markRead={() => markGroupRead(group._id)}
            sendRest={(text) => sendGroupMessageRest(group._id, text)}
          />
        </View>
      ) : tab === "Members" ? (
        <MembersTab slug={group.slug} ownerId={group.owner?._id} styles={styles} />
      ) : tab === "Overview" ? (
        <CommunityHubTab group={group} />
      ) : (
        <AboutTab group={group} tone={tone} styles={styles} />
      )}

      {/* The app's own dialog, as for deleting an account — leaving is
          reversible, so its button is a soft red rather than a solid one. */}
      <ConfirmDialog
        visible={confirmingLeave}
        icon="exit-outline"
        title={t("Leave community?")}
        message={t("You'll stop getting {{name}}'s messages. You can join again at any time.", { name: group.name })}
        confirmLabel={t("Leave")}
        cancelLabel={t("Cancel")}
        danger
        onConfirm={leave}
        onCancel={() => setConfirmingLeave(false)}
      />

      {isOwner ? (
        <>
          <AdminPanelModal
            visible={adminPanelOpen}
            onClose={() => setAdminPanelOpen(false)}
            onEditIdentity={() => {
              setAdminPanelOpen(false);
              setEditingIdentity(true);
            }}
            onPinList={() => {
              setAdminPanelOpen(false);
              router.push(`/group-list-editor?slug=${group.slug}` as never);
            }}
            onNewPoll={() => {
              setAdminPanelOpen(false);
              router.push(`/create-poll?slug=${group.slug}` as never);
            }}
            onNewChallenge={() => {
              setAdminPanelOpen(false);
              router.push(`/group-content-picker?slug=${group.slug}` as never);
            }}
            onNewWatchParty={() => {
              setAdminPanelOpen(false);
              router.push(`/schedule-watch-party?slug=${group.slug}` as never);
            }}
            onFeedAnnouncements={() => {
              setAdminPanelOpen(false);
              setEditingFeedAnnouncements(true);
            }}
          />
          <EditCommunityIdentityModal visible={editingIdentity} group={group} onClose={() => setEditingIdentity(false)} onSaved={reload} />
          <EditFeedAnnouncementsModal visible={editingFeedAnnouncements} group={group} onClose={() => setEditingFeedAnnouncements(false)} onSaved={reload} />
        </>
      ) : null}
    </View>
  );
}
