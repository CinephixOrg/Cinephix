import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, LayoutAnimation, Linking, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import DiscoverListCard from "../DiscoverListCard";
import StackedAvatars from "../StackedAvatars";
import WatchPartyCard from "./WatchPartyCard";
import CommunityLeaderboardRows from "./CommunityLeaderboardRows";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useSafety } from "../../context/SafetyContext";
import { useToast } from "../../context/ToastContext";
import { getGroupChallenge, getGroupLeaderboard, listWatchParties, pollHighlightCardUrl, toggleWatchPartyRsvp, watchPartyHighlightCardUrl } from "../../api/groupService";
import { voteOnPoll } from "../../api/shareService";
import CommunityTags from "./CommunityTags";
import { categoryTone, isDarkTheme } from "./communityCategory";
import { localeUpper } from "../../utils/text";
import { isWatchPartyLive } from "../../utils/watchParty";
import type { Group, GroupChallenge, GroupLeaderboardEntry, GroupWatchParty, PollOption } from "../../types";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
// How long a freshly pinned poll/challenge gets a "New" badge — direct
// ask: something just created should be obviously announced, not just
// quietly present the next time someone opens Overview.
const NEW_BADGE_WINDOW_MS = 48 * 60 * 60 * 1000;

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_BADGE_WINDOW_MS;
}

type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors, accent: string) {
  return StyleSheet.create({
    container: { padding: 16, gap: 24 },
    // A slim announcement strip, not a full duplicate card — direct ask:
    // a live watch party deserves to be the first thing on the page
    // ("en başta da olmalı"), but the rich card for it already lives
    // just below, inside Watch Parties itself. This is a nudge pointing
    // down at that (or straight into the room, when there's exactly
    // one), same "announcement bar" convention the Chat tab's own
    // LiveBanner already uses ([slug].tsx) — not a second full rendering
    // of the same content.
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      backgroundColor: colors.base200,
    },
    liveBannerText: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.baseContent },
    section: { gap: 10 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    sectionIconBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}22` },
    sectionTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.baseContent },
    newBadge: { backgroundColor: accent, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    newBadgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.base100, letterSpacing: 0.3 },
    endedBadge: { backgroundColor: colors.base300, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    endedBadgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.placeholder, letterSpacing: 0.3 },
    // Dims an ended poll/challenge's own card — still readable (final
    // results matter), just visually demoted under whatever's still active.
    cardEnded: { opacity: 0.55 },
    card: { backgroundColor: colors.base200, borderRadius: 16, padding: 14, gap: 10 },

    socialRow: { flexDirection: "row", gap: 10 },
    socialIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.base200, alignItems: "center", justifyContent: "center" },

    listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    listPosterStrip: { flexDirection: "row" },
    listPoster: { width: 36, height: 54, borderRadius: 6, marginRight: -14, borderWidth: 1.5, borderColor: colors.base200 },
    listInfo: { flex: 1, minWidth: 0 },
    listName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
    listMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder, marginTop: 2 },

    pollQuestion: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent, marginBottom: 2 },
    // Same track/fill/row overlay ShareCard's own official poll cards use
    // (pollResultTrack/Fill/Row there) — direct ask to match that in-card
    // design here too. The optional poster thumbnail sits outside the
    // track as a leading element, same spot it occupied before.
    pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    pollPoster: { width: 28, height: 42, borderRadius: 5, backgroundColor: colors.base300 },
    pollResultTrack: { flex: 1, borderRadius: 8, backgroundColor: colors.base300, overflow: "hidden", justifyContent: "center" },
    pollResultFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.28 },
    pollResultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 12 },
    pollResultLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.baseContent, flexShrink: 1, marginRight: 6 },
    pollResultLabelChosen: { fontFamily: fonts.bold },
    pollResultTrailing: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
    pollResultPercent: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },

    challengeTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    challengeMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.base300, overflow: "hidden" },
    progressFill: { height: 8, borderRadius: 4 },
    // The challenge card's own visual upgrade — direct ask ("daha görsel
    // bir şeyler ekleyebiliriz", then a direct correction away from an
    // overlapping cascade: plain, non-overlapping tiles in a clean row,
    // same grid language the challenge detail page's own poster grid
    // uses, so the card reads as a preview of that, not a different
    // shape entirely.
    challengePosterGrid: { flexDirection: "row", gap: 4, marginBottom: 2 },
    challengePosterTile: { flex: 1, aspectRatio: 2 / 3, borderRadius: 6, backgroundColor: colors.base300, overflow: "hidden" },
    challengeMoreTile: { alignItems: "center", justifyContent: "center" },
    challengeMoreText: { fontFamily: fonts.bold, fontSize: 11, color: colors.placeholder },

    featuredListsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    seeAllText: { fontFamily: fonts.bold, fontSize: 12.5, color: accent },

    // Past Activity — collapsed by default, direct ask: "hala güncel ile
    // geçmiş aktiviteler arasında kesin bir ayrım yok." Every ended poll/
    // challenge and every past watch party lives ONLY here now, never
    // interleaved with the still-active ones above.
    pastToggle: { flexDirection: "row", alignItems: "center", gap: 10 },
    pastToggleCount: { marginLeft: "auto", fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
    pastGroup: { gap: 8 },
    pastGroupLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.4, color: colors.placeholder, textTransform: "uppercase" },

    partyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    partyRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    partyRowPast: { opacity: 0.7 },
    partyRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
    partyPoster: { width: 32, height: 48, borderRadius: 5, backgroundColor: colors.base300 },
    partyInfo: { flex: 1, minWidth: 0 },
    partyTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
    partyMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder, marginTop: 2 },
    shareIconButton: { marginLeft: "auto", padding: 4 },

    emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder, textAlign: "center", paddingVertical: 12 },

    // De-emphasized on purpose — identity info (what this community IS)
    // rather than its live activity, so it sits quietly at the bottom
    // instead of competing with the poll/challenge/watch-party cards
    // above it for attention.
    // Website-footer styling — a thin divider then small, dim text, so this
    // reads as the page's own colophon rather than another active section.
    footerAbout: { gap: 8 },
    footerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 6 },
    footerAboutHeading: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.placeholder, letterSpacing: 0.4, textTransform: "uppercase" },
    footerAboutText: { fontSize: 12.5, lineHeight: 18, color: colors.placeholder },
    footerMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    footerMetaText: { fontSize: 11.5, color: colors.placeholder },
  });
}

function normalizeLink(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

interface Props {
  group: Group;
}

// Everything specific to a partner community (owner != null) — a live/
// upcoming watch party, pinned list, poll, challenge, the community-only
// leaderboard, and its own identity (description/tags/created date, moved
// here from the old About tab so it isn't shown twice). Admin actions
// themselves live in GroupDetailScreen's own single "Manage" panel now,
// not here — direct ask, they used to sit as a loose button row mixed
// into this content. Only ever rendered on a community that actually has
// an owner; the app's own preset topic rooms never show this tab at all.
export default function CommunityHubTab({ group }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openContentActions } = useSafety();
  const { showToast } = useToast();
  const router = useRouter();
  const accent = group.accentColor || colors.primary;
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);
  const isOwner = !!user && group.owner?._id === user._id;
  const dark = isDarkTheme(colors);
  const tone = categoryTone(group.category, dark);

  const [challenge, setChallenge] = useState<GroupChallenge | null | undefined>(undefined);
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[] | undefined>(undefined);
  const [watchParties, setWatchParties] = useState<{ upcoming: GroupWatchParty[]; past: GroupWatchParty[] } | undefined>(undefined);
  const [rsvping, setRsvping] = useState<string | null>(null);
  // Past Activity's own single collapse — direct ask: current and past
  // should read as clearly separate, not the past quietly bleeding into
  // the same list the active stuff sits in.
  const [pastExpanded, setPastExpanded] = useState(false);
  const [pollOptions, setPollOptions] = useState<PollOption[] | null>(group.pinnedPoll?.options ?? null);
  const [userVoteIndex, setUserVoteIndex] = useState<number | null>(group.pinnedPoll?.userVoteIndex ?? null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    setPollOptions(group.pinnedPoll?.options ?? null);
    setUserVoteIndex(group.pinnedPoll?.userVoteIndex ?? null);
  }, [group.pinnedPoll]);

  useEffect(() => {
    let cancelled = false;
    getGroupChallenge(group.slug)
      .then((c) => {
        if (!cancelled) setChallenge(c);
      })
      .catch(() => {
        if (!cancelled) setChallenge(null);
      });
    getGroupLeaderboard(group.slug)
      .then((r) => {
        if (!cancelled) setLeaderboard(r.leaderboard);
      })
      .catch(() => {
        if (!cancelled) setLeaderboard([]);
      });
    listWatchParties(group.slug)
      .then((r) => {
        if (!cancelled) setWatchParties(r);
      })
      .catch(() => {
        if (!cancelled) setWatchParties({ upcoming: [], past: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [group.slug]);

  const rsvpToParty = useCallback(
    async (party: GroupWatchParty) => {
      if (rsvping) return;
      setRsvping(party._id);
      try {
        const result = await toggleWatchPartyRsvp(group.slug, party._id);
        setWatchParties((current) =>
          current
            ? { ...current, upcoming: current.upcoming.map((p) => (p._id === party._id ? { ...p, isRsvped: result.isRsvped, rsvpCount: result.rsvpCount } : p)) }
            : current
        );
      } catch (e: any) {
        showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      } finally {
        setRsvping(null);
      }
    },
    [group.slug, rsvping, showToast, t]
  );

  // RN's own core Share API — no new native dependency (the actual image
  // attach needs expo-sharing, which isn't in this build yet; see
  // groupController.js's own comment on the backend side). `url` only
  // reaches the share sheet on iOS; Android's Share.share ignores it
  // entirely, which is why it's repeated inside `message` too — still a
  // real, usable link there, just plain text instead of an attachment.
  const sharePollHighlight = useCallback(async () => {
    const url = pollHighlightCardUrl(group.slug);
    try {
      await Share.share({ message: t("Vote in {{name}}'s poll on Cinephix! {{url}}", { name: group.name, url }), url });
    } catch {}
  }, [group.slug, group.name, t]);

  const shareWatchPartyHighlight = useCallback(
    async (party: GroupWatchParty) => {
      const url = watchPartyHighlightCardUrl(group.slug, party._id);
      try {
        await Share.share({ message: t("{{name}}'s watch party recap on Cinephix! {{url}}", { name: group.name, url }), url });
      } catch {}
    },
    [group.slug, group.name, t]
  );

  const vote = useCallback(
    async (index: number) => {
      if (!group.pinnedPoll || voting) return;
      setVoting(true);
      try {
        const result = await voteOnPoll(group.pinnedPoll._id, index);
        setPollOptions(result.options);
        setUserVoteIndex(result.userVoteIndex);
      } catch (e: any) {
        showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      } finally {
        setVoting(false);
      }
    },
    [group.pinnedPoll, voting, showToast, t]
  );

  const social = group.socialLinks;
  const hasSocial = !!(social?.instagram || social?.tiktok || social?.youtube);
  const totalVotes = pollOptions ? pollOptions.reduce((sum, o) => sum + o.voteCount, 0) : 0;

  // Every party still inside its own "live" window (admin's own per-party
  // duration — isWatchPartyLive) — more than one can be live at once on
  // purpose (direct ask: concurrent watch parties for different titles
  // are allowed, nothing stops a member from hopping between them).
  const liveParties = watchParties?.past.filter(isWatchPartyLive) ?? [];
  const liveIds = new Set(liveParties.map((p) => p._id));
  // Everything else past goes to Past Activity, not a secondary "show N
  // more" inside the main Watch Parties card.
  const pastParties = watchParties?.past.filter((p) => !liveIds.has(p._id)) ?? [];
  // Overview's own cap — live first (most urgent), then soonest-upcoming;
  // "See all" (the full watch-parties page) is what the rest are for.
  const MAX_OVERVIEW_PARTY_CARDS = 3;
  const overviewParties = [...liveParties, ...(watchParties?.upcoming ?? [])];
  const visibleOverviewParties = overviewParties.slice(0, MAX_OVERVIEW_PARTY_CARDS);
  const hiddenPartyCount = overviewParties.length - visibleOverviewParties.length;
  const activeChallenge = challenge && !challenge.isExpired ? challenge : null;
  const endedChallenge = challenge && challenge.isExpired ? challenge : null;
  const activePoll = group.pinnedPoll && !group.pinnedPoll.isExpired ? group.pinnedPoll : null;
  const endedPoll = group.pinnedPoll?.isExpired ? group.pinnedPoll : null;
  const pastCount = pastParties.length + (endedChallenge ? 1 : 0) + (endedPoll ? 1 : 0);
  const togglePast = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setPastExpanded((e) => !e);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* A live watch party is the single most urgent thing on this page
          — direct ask ("en başta da olmalı") — so it leads even ahead of
          Challenge/Leaderboard, but only as a slim announcement strip,
          not the full rich card (that's still inside Watch Parties
          itself, further down, with its own accent border + pulsing
          badge + attendee avatars) — showing the same content twice at
          full size would just repeat itself. Exactly one live party opens
          it directly; more than one opens the full list instead of
          guessing which to jump into. */}
      {liveParties.length > 0 ? (
        <Pressable
          style={styles.liveBanner}
          onPress={() =>
            liveParties.length === 1
              ? router.push(`/socials/communities/${group.slug}/watch-party/${liveParties[0]._id}` as never)
              : router.push(`/socials/communities/${group.slug}/watch-parties` as never)
          }
        >
          <Ionicons name="radio" size={15} color={accent} />
          <Text style={styles.liveBannerText} numberOfLines={1}>
            {liveParties.length === 1
              ? t("Live now: {{title}}", { title: liveParties[0].contentTitle })
              : t("{{count}} watch parties live now", { count: liveParties.length })}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={accent} />
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <View style={styles.featuredListsHeaderRow}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="podium" size={14} color={accent} />
            </View>
            <Text style={styles.sectionTitle}>{t("This Week's Leaderboard")}</Text>
          </View>
          {leaderboard && leaderboard.length > 3 ? (
            <Pressable onPress={() => router.push(`/socials/communities/${group.slug}/leaderboard` as never)} hitSlop={8}>
              <Text style={styles.seeAllText}>{t("See all")}</Text>
            </Pressable>
          ) : null}
        </View>
        {leaderboard === undefined ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>{t("No activity yet this week.")}</Text>
          </View>
        ) : (
          <CommunityLeaderboardRows entries={leaderboard} limit={3} />
        )}
      </View>

      {hasSocial ? (
        <View style={styles.socialRow}>
          {social?.instagram ? (
            <Pressable style={styles.socialIcon} onPress={() => Linking.openURL(normalizeLink(social.instagram!))}>
              <Ionicons name="logo-instagram" size={18} color={accent} />
            </Pressable>
          ) : null}
          {social?.tiktok ? (
            <Pressable style={styles.socialIcon} onPress={() => Linking.openURL(normalizeLink(social.tiktok!))}>
              <Ionicons name="logo-tiktok" size={18} color={accent} />
            </Pressable>
          ) : null}
          {social?.youtube ? (
            <Pressable style={styles.socialIcon} onPress={() => Linking.openURL(normalizeLink(social.youtube!))}>
              <Ionicons name="logo-youtube" size={18} color={accent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {activePoll ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="bar-chart" size={14} color={accent} />
            </View>
            <Text style={styles.sectionTitle}>{t("Community Poll")}</Text>
            {isNew(activePoll.createdAt) ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{localeUpper(t("New"))}</Text>
              </View>
            ) : null}
            {isOwner ? (
              <Pressable style={styles.shareIconButton} onPress={sharePollHighlight} hitSlop={8}>
                <Ionicons name="share-social-outline" size={17} color={colors.placeholder} />
              </Pressable>
            ) : (
              // Reuses the app's own existing report+block sheet
              // (SafetyContext) — the Share model (what a community poll
              // actually is, server-side) was already a reportable entity
              // type, this just gives it an entry point. Not shown to the
              // owner — reporting your own poll is a no-op the backend
              // already rejects.
              <Pressable
                style={styles.shareIconButton}
                onPress={() =>
                  openContentActions({
                    entityType: "Share",
                    entityId: activePoll._id,
                    author: group.owner ? { _id: group.owner._id, username: group.owner.username } : null,
                  })
                }
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.placeholder} />
              </Pressable>
            )}
          </View>
          <View style={styles.card}>
            {activePoll.question ? <Text style={styles.pollQuestion}>{activePoll.question}</Text> : null}
            {(pollOptions ?? []).map((option, index) => {
              const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
              const mine = userVoteIndex === index;
              return (
                <Pressable
                  key={option.contentId ? `${option.contentId}-${index}` : `text-${index}`}
                  style={styles.pollOptionRow}
                  onPress={() => vote(index)}
                  disabled={voting}
                >
                  {option.posterUrl ? <Image source={{ uri: `${POSTER_BASE}${option.posterUrl}` }} style={styles.pollPoster} /> : null}
                  <View style={styles.pollResultTrack}>
                    <View style={[styles.pollResultFill, { width: `${pct}%`, backgroundColor: mine ? accent : colors.border }]} />
                    <View style={styles.pollResultRow}>
                      <Text style={[styles.pollResultLabel, mine && styles.pollResultLabelChosen]} numberOfLines={2}>
                        {mine ? `✓ ${option.text}` : option.text}
                      </Text>
                      <View style={styles.pollResultTrailing}>
                        {option.topVoters && option.topVoters.length > 0 ? <StackedAvatars users={option.topVoters} size={16} max={5} /> : null}
                        <Text style={styles.pollResultPercent}>{pct}%</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeChallenge ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="trophy" size={14} color={accent} />
            </View>
            <Text style={styles.sectionTitle}>{t("Challenge")}</Text>
            {isNew(activeChallenge.createdAt) ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{localeUpper(t("New"))}</Text>
              </View>
            ) : null}
          </View>
          <Pressable style={styles.card} onPress={() => router.push(`/socials/communities/${group.slug}/challenge` as never)}>
            <View style={styles.challengePosterGrid}>
              {activeChallenge.items.slice(0, activeChallenge.items.length > 6 ? 5 : 6).map((item) => (
                <View key={`${item.itemType}-${item.itemId}`} style={styles.challengePosterTile}>
                  {item.posterUrl ? <Image source={{ uri: `${POSTER_BASE}${item.posterUrl}` }} style={StyleSheet.absoluteFill} /> : null}
                </View>
              ))}
              {activeChallenge.items.length > 6 ? (
                <View style={[styles.challengePosterTile, styles.challengeMoreTile]}>
                  <Text style={styles.challengeMoreText}>+{activeChallenge.items.length - 5}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.challengeTitle}>{activeChallenge.title}</Text>
            <Text style={styles.challengeMeta}>{t("Ends {{date}}", { date: new Date(activeChallenge.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }) })}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.round((activeChallenge.myProgress / Math.max(1, activeChallenge.total)) * 100))}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text style={styles.challengeMeta}>
              {t("You: {{done}}/{{total}}", { done: activeChallenge.myProgress, total: activeChallenge.total })} · {t("{{count}} finished", { count: activeChallenge.completedCount })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {visibleOverviewParties.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.featuredListsHeaderRow}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="calendar" size={14} color={accent} />
              </View>
              <Text style={styles.sectionTitle}>{t("Watch Parties")}</Text>
            </View>
            {hiddenPartyCount > 0 ? (
              <Pressable onPress={() => router.push(`/socials/communities/${group.slug}/watch-parties` as never)} hitSlop={8}>
                <Text style={styles.seeAllText}>{t("See all")}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ gap: 10 }}>
            {visibleOverviewParties.map((party) => (
              <WatchPartyCard
                key={party._id}
                party={party}
                live={liveIds.has(party._id)}
                accent={accent}
                onPress={() => router.push(`/socials/communities/${group.slug}/watch-party/${party._id}` as never)}
                onRsvp={() => rsvpToParty(party)}
                rsvping={rsvping === party._id}
              />
            ))}
          </View>
        </View>
      ) : null}

      {group.pinnedLists && group.pinnedLists.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.featuredListsHeaderRow}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="albums" size={14} color={accent} />
              </View>
              <Text style={styles.sectionTitle}>{t("Featured Lists")}</Text>
            </View>
            <Pressable onPress={() => router.push(`/socials/communities/${group.slug}/lists` as never)} hitSlop={8}>
              <Text style={styles.seeAllText}>{t("See all")}</Text>
            </Pressable>
          </View>
          <View>
            {group.pinnedLists.map((list) => (
              <DiscoverListCard
                key={list._id}
                list={{ ...list, owner: null }}
                communityIdentity={{ name: group.name, coverImage: group.coverImage }}
                compact
                // Nested under this same community's own stack (not the
                // root-level /lists/:id) — real bug, reported live:
                // that root route left Back landing somewhere unrelated
                // (a profile page from earlier history, not this
                // community) instead of returning here.
                onPress={() => router.push(`/socials/communities/${group.slug}/lists/${list._id}` as never)}
                basePath="/socials"
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Everything that's over — direct ask: current and past activity
          weren't clearly separated before (an ended poll/challenge just
          sat, dimmed, among the active ones; past watch parties lived in
          the same card as upcoming ones). Collapsed by default so it
          never competes with what's actually still going on above it. */}
      {pastCount > 0 ? (
        <View style={styles.section}>
          <Pressable style={styles.pastToggle} onPress={togglePast}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="time" size={14} color={accent} />
            </View>
            <Text style={styles.sectionTitle}>{t("Past Activity")}</Text>
            <Text style={styles.pastToggleCount}>{pastCount}</Text>
            <Ionicons name={pastExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.placeholder} />
          </Pressable>

          {pastExpanded ? (
            <>
              {endedChallenge ? (
                <View style={styles.pastGroup}>
                  <Text style={styles.pastGroupLabel}>{t("Challenge")}</Text>
                  <Pressable
                    style={[styles.card, styles.cardEnded]}
                    onPress={() => router.push(`/socials/communities/${group.slug}/challenge` as never)}
                  >
                    <Text style={styles.challengeTitle}>{endedChallenge.title}</Text>
                    <Text style={styles.challengeMeta}>
                      {t("Ended {{date}}", { date: new Date(endedChallenge.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }) })}
                      {" · "}
                      {t("{{count}} finished", { count: endedChallenge.completedCount })}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {endedPoll ? (
                <View style={styles.pastGroup}>
                  <Text style={styles.pastGroupLabel}>{t("Community Poll")}</Text>
                  <View style={[styles.card, styles.cardEnded]}>
                    {endedPoll.question ? <Text style={styles.pollQuestion}>{endedPoll.question}</Text> : null}
                    {(pollOptions ?? []).map((option, index) => {
                      const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
                      const mine = userVoteIndex === index;
                      return (
                        <View key={option.contentId ? `${option.contentId}-${index}` : `text-${index}`} style={styles.pollOptionRow}>
                          {option.posterUrl ? <Image source={{ uri: `${POSTER_BASE}${option.posterUrl}` }} style={styles.pollPoster} /> : null}
                          <View style={styles.pollResultTrack}>
                            <View style={[styles.pollResultFill, { width: `${pct}%`, backgroundColor: mine ? accent : colors.border }]} />
                            <View style={styles.pollResultRow}>
                              <Text style={[styles.pollResultLabel, mine && styles.pollResultLabelChosen]} numberOfLines={2}>
                                {mine ? `✓ ${option.text}` : option.text}
                              </Text>
                              <View style={styles.pollResultTrailing}>
                                {option.topVoters && option.topVoters.length > 0 ? <StackedAvatars users={option.topVoters} size={16} max={5} /> : null}
                                <Text style={styles.pollResultPercent}>{pct}%</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {pastParties.length > 0 ? (
                <View style={styles.pastGroup}>
                  <Text style={styles.pastGroupLabel}>{t("Watch Parties")}</Text>
                  <View style={styles.card}>
                    {pastParties.map((party, i) => (
                      <Pressable
                        key={party._id}
                        style={[styles.partyRow, i > 0 && styles.partyRowDivider, styles.partyRowPast]}
                        onPress={() => router.push(`/socials/communities/${group.slug}/watch-party/${party._id}` as never)}
                      >
                        <View style={styles.partyRowMain}>
                          {party.contentPosterUrl ? <Image source={{ uri: `${POSTER_BASE}${party.contentPosterUrl}` }} style={styles.partyPoster} /> : null}
                          <View style={styles.partyInfo}>
                            <Text style={styles.partyTitle} numberOfLines={1}>
                              {party.contentTitle}
                            </Text>
                            <Text style={styles.partyMeta}>
                              {new Date(party.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {t("{{count}} attended", { count: party.attendeeCount ?? 0 })}
                            </Text>
                          </View>
                        </View>
                        {isOwner ? (
                          <Pressable style={styles.shareIconButton} onPress={() => shareWatchPartyHighlight(party)} hitSlop={8}>
                            <Ionicons name="share-social-outline" size={17} color={colors.placeholder} />
                          </Pressable>
                        ) : null}
                        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {/* Moved below Past Activity and restyled as a muted footer — direct
          ask: this used to sit prominently at the very bottom looking
          "absurd" (hashtags/date with no real emphasis). A thin divider
          then dim, small text reads as a website's own footer block
          (privacy-policy-style), not a competing section. */}
      <View style={styles.footerAbout}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerAboutHeading}>{t("About")}</Text>
        {group.description ? <Text style={styles.footerAboutText}>{group.description}</Text> : null}
        {group.tags.length > 0 ? <CommunityTags tags={group.tags} tone={tone} size="small" /> : null}
        <View style={styles.footerMetaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.placeholder} />
          <Text style={styles.footerMetaText}>
            {t("Created")} {new Date(group.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
