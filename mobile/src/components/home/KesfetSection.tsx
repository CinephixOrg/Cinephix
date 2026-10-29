import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, RefreshControl, StyleSheet } from "react-native";
// From react-native-gesture-handler, not react-native — this ScrollView sits
// between home/index.tsx's outer horizontal pager and this page's own
// horizontal rails (ContentRail, TrendingRail); every scroller in that
// chain needs to share the gesture-handler resolution system or nested
// horizontal swipes break (see home/index.tsx's own comment for the full story).
import { ScrollView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularWithFriends, getCommunityAnnouncements } from "../../api/feedService";
import { getReviewsFeed } from "../../api/reviewService";
import { getPopularLists } from "../../api/listService";
import { loadCommunities } from "../../api/communitiesStore";
import ContentRail from "../ContentRail";
import AddedByCard from "../AddedByCard";
import ReviewsSwiper from "../ReviewsSwiper";
import ListsSwiper from "../ListsSwiper";
import CommunityAnnouncementsSwiper from "../CommunityAnnouncementsSwiper";
import ActivitySection from "./ActivitySection";
import WhatToWatchRail from "./WhatToWatchRail";
import NewReleasesRail from "./NewReleasesRail";
import TrendingRail from "./TrendingRail";
import SlidingUnderlineTabs, { type TabItem } from "../SlidingUnderlineTabs";
import { SkeletonRail } from "../Skeleton";
import { PosterRevealProvider } from "../../context/PosterRevealContext";
import type { PopularThisWeekItem, PopularReview, DiscoverListItem, GroupAnnouncement, Group, CommunityRailItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import AdBanner from "../ads/AdBanner";
import { AD_UNIT_IDS } from "../../constants/adUnitIds";

// "See all" was removed from both rails, then reinstated a round later —
// both routes (home/reviews.tsx, home/lists-discover.tsx) kept working the
// whole time, just briefly unreachable from here. Left at 10 rather than
// reverting to the smaller pre-removal preview counts — a fuller in-place
// preview plus a real "See all" isn't a contradiction.
const REVIEWS_PREVIEW_COUNT = 10;
const LISTS_PREVIEW_COUNT = 10;

// TC-135 — Discover regrouped into 3 switchable tabs (Trending/Popular/
// Friends) after direct feedback that the earlier one-continuous-scroll
// layout (10 stacked sections) read as too flashy/dense. The Most
// Favorited/Highest Rated/Most Recommended podium (LeaderboardPodium.tsx,
// GET /feed/leaderboard) stays exactly where it was — first child of the
// page, scrolling away normally like everything else (direct ask: the
// page itself must still scroll, not sit permanently fixed). The tab bar
// (SlidingUnderlineTabs.tsx, same shared component Search's own Films/
// Series/Reviews/Lists/Users row uses) is the ONE part that pins to the
// top instead of disappearing once scrolled past — plain React Native's
// own `stickyHeaderIndices` on the outer ScrollView (index 1, right after
// the Podium at index 0), not a custom scroll-offset mechanism. One
// swipeable component hosts all 3 podium lists (not three permanently-
// visible sections — the user found that too repetitive, same podium
// shape shown 3x in a row), with its own round movie/series mode toggle.
// The podium fetches and owns its leaderboard data entirely by itself
// (not passed down as props from this component's own load())
// specifically so that toggle can refetch just the podium on tap, without
// re-running this page's other sources. A hairline divider still
// separates every top-level section within a tab, same convention as
// before.
// Reviews and Lists still keep their full, independently-paginated feeds
// (ReviewsSection.tsx's own infinite-scroll FlatList, unchanged) — nesting
// that same-direction scroll inside this page's own ScrollView would be
// the exact same anti-pattern already hit and fixed elsewhere in this
// app's history, but neither preview here still links out to them
// ("See all" was removed from both, per direct request — each preview's
// own count cap (10) is now the whole thing, not a lead-in to more).
// `home/reviews.tsx`/`home/lists-discover.tsx` still exist and still work
// if ever linked again, just currently unreachable from this page. Lists'
// preview used to be a horizontal ContentRail (ListRailCard.tsx, poster-
// forward, several cards visible side by side, matching AddedByCard's own
// grammar) — replaced with ListsSwiper.tsx, a real full-width one-card-per-
// swipe pager (direct ask to match Reviews' own "one at a time" feel
// instead), rendering SearchListCard.tsx (Search's own Lists tab design,
// also reused verbatim per direct ask) rather than the old rail card.
// ListRailCard.tsx itself was deleted once nothing referenced it anymore —
// `DiscoverListCard.tsx` is a separate, still-used component (unaffected),
// the full-width card `ListsSection.tsx`/`SearchListsSection.tsx` use for
// their own full browsing pages. Reviews' preview went through that same
// poster-forward phase too, but got pulled back out of it earlier — a
// review's actual value is the written opinion, not a poster, and
// squeezing it into a narrow rail-card grammar buried the one thing worth
// reading behind a truncated quote. It's now ReviewsSwiper.tsx +
// ReviewSwipeCard.tsx, a horizontal scroller sized so ~1.5 cards are
// visible at once (the partial next card is the only "more to scroll"
// affordance — no chevron hints), each card a real side-by-side
// poster+text layout with its own peek/expand interactions (see that
// component's own doc comment). Both ReviewSwipeCard.tsx and
// SearchListCard.tsx now also carry a Premium gold-frame treatment
// matching ShareCard.tsx's own posts, per direct ask. Activity (previously bundled into the
// now-deleted ContentTypeSection.tsx, then paused for a while) is back as
// its own section (ActivitySection.tsx) — a real network-scoped feed
// (GET /feed/activity, activityController.js's getNetworkActivity), not
// the old self-only one ContentTypeSection used. Deliberately excludes
// favorite-adds for now — see that function's own doc comment for why
// (favoriteMovies/favoriteSeries aren't per-item timestamped the way
// watchlist already is, and giving them one touches match-making/
// leaderboard code elsewhere — a separate task, not bundled into this).
// Builds one interleaved list for the "Community Announcements" rail out
// of two separately-fetched sources — a member's own community events and
// the "popular community" discovery cards shown to everyone. Direct ask,
// after an earlier version rendered these as two separate rails/headings:
// lead with a couple of popular cards, then the member announcements
// (their own rough order — most recent first, already how the backend
// returns them), with a popular card dropped back in every few
// announcements so a long run of internal news doesn't crowd discovery
// out entirely; any popular cards left over land at the end.
const POPULAR_CARDS_LEADING = 2;
const ANNOUNCEMENTS_PER_POPULAR_BREAK = 3;
function buildCommunityRailItems(announcements: GroupAnnouncement[], popularCommunities: Group[]): CommunityRailItem[] {
  const items: CommunityRailItem[] = [];
  let p = 0;
  const takePopular = (n: number) => {
    for (let i = 0; i < n && p < popularCommunities.length; i++, p++) {
      items.push({ kind: "popular", key: `popular-${popularCommunities[p]._id}`, data: popularCommunities[p] });
    }
  };
  takePopular(POPULAR_CARDS_LEADING);
  announcements.forEach((a, i) => {
    items.push({ kind: "announcement", key: a._id, data: a });
    if ((i + 1) % ANNOUNCEMENTS_PER_POPULAR_BREAK === 0) takePopular(1);
  });
  takePopular(popularCommunities.length - p);
  return items;
}

interface Props {
  // True while Discover is the currently-visible page of home/index.tsx's
  // pager. KesfetSection only ever mounts once and then stays alive
  // forever (visitedTabs' lazy-mount-once pattern), so without this it has
  // no way to know the user swiped away to Shares and back — meaning a
  // like/view registered elsewhere (e.g. liking a list-type Share, which
  // now also updates the underlying CustomList's own likeCount/views)
  // would sit stale in listsPreview until the app restarted. Optional so
  // every other caller of this component (none currently, but same
  // defensive convention as elsewhere in this app) doesn't need to pass it.
  isActive?: boolean;
}

export default function KesfetSection({ isActive }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // No top padding — direct ask: the sticky tab bar (now index 0,
        // the podium that used to sit above it is gone) should start
        // flush against the header's own bottom edge, with no gap.
        container: { paddingBottom: 16, flexGrow: 1 },
        // Between every top-level section on the page (each Trending
        // rail, Reviews, Lists) — the user's own explicit ask, distinct
        // from each section's own internal marginBottom.
        sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16, marginBottom: 24 },
        // Direct ask — the first rail's title used to start right at the
        // sticky tab bar's own bottom edge with zero breathing room.
        tabContent: { paddingTop: 16 },
        tabContentHidden: { display: "none" },
      }),
    [colors]
  );

  // TC-135's 3 Discover tabs — Trending owns the merged movie/series rail
  // itself now (TrendingRail.tsx, mirroring LeaderboardPodium's own
  // self-fetching convention), so it's no longer part of this component's
  // own load()/Promise.all below.
  const DISCOVER_TABS: TabItem[] = useMemo(
    () => [
      { key: "trending", label: t("Trending") },
      { key: "popular", label: t("Popular") },
      { key: "friends", label: t("Friends") },
    ],
    [t]
  );
  const [activeTab, setActiveTab] = useState<string>("trending");

  const [friendsChoice, setFriendsChoice] = useState<PopularThisWeekItem[]>([]);
  const [reviewsPreview, setReviewsPreview] = useState<PopularReview[]>([]);
  const [listsPreview, setListsPreview] = useState<DiscoverListItem[]>([]);
  const [communityAnnouncements, setCommunityAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [popularCommunities, setPopularCommunities] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [friendsRes, reviewsRes, listsRes, announcementsRes, communitiesRes] = await Promise.all([
      getPopularWithFriends(20), // no type — movies and series mixed in one rail
      getReviewsFeed(1, REVIEWS_PREVIEW_COUNT),
      getPopularLists(LISTS_PREVIEW_COUNT),
      getCommunityAnnouncements(10),
      loadCommunities(),
    ]);
    setFriendsChoice(friendsRes);
    setReviewsPreview(reviewsRes.items);
    setListsPreview(listsRes);
    setCommunityAnnouncements(announcementsRes);
    // Discovery only — communities already joined have nothing to "discover"
    // here, their activity already surfaces via the rail above instead.
    setPopularCommunities(
      communitiesRes
        .filter((g) => !g.isMember)
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 8)
    );
  }, []);

  const communityRailItems = useMemo(() => buildCommunityRailItems(communityAnnouncements, popularCommunities), [communityAnnouncements, popularCommunities]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Silently re-fetches just the Popular Lists rail (cheap — a single,
  // small-limit request) every time the user returns to Discover after
  // having been on Shares, so a like/view that just happened elsewhere
  // (a list-type Share's like now mirrors onto the real list, see
  // shareController.js) shows up immediately instead of staying stale
  // until the app restarts. Skips the very first activation — that case
  // is already covered by the mount-time load() above, so refetching here
  // too would just be a redundant duplicate request.
  const skippedFirstActivation = useRef(false);
  useEffect(() => {
    if (!isActive) return;
    if (!skippedFirstActivation.current) {
      skippedFirstActivation.current = true;
      return;
    }
    getPopularLists(LISTS_PREVIEW_COUNT).then(setListsPreview);
  }, [isActive]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.container}>
        <SkeletonRail />
        <SkeletonRail />
        <SkeletonRail />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.base100 }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      // The tab bar itself pins to the top once scrolling would otherwise
      // carry it off-screen, instead of disappearing. `stickyHeaderIndices`
      // is plain React Native's own built-in mechanism for exactly this
      // (the child at this index docks at the scroll container's top edge
      // once reached). Index 0 is the tab bar itself now — the podium
      // (which used to sit above it at index 0, pushing it to index 1) is
      // gone from this page entirely; it's reached via PodiumHeaderIcon in
      // the header instead, per direct ask not to have it "in band form."
      stickyHeaderIndices={[0]}
    >
      <SlidingUnderlineTabs tabs={DISCOVER_TABS} activeKey={activeTab} onChange={setActiveTab} />

      {/* All 3 tabs stay mounted permanently (hidden via display:none
          rather than conditionally rendered) — direct ask, tab-switching
          felt sluggish because unmounting a tab lost TrendingRail's/
          ActivitySection's own self-fetched state, forcing a full network
          refetch (plus remount cost) on every single switch back to it.
          display:"none" removes a hidden tab from layout entirely (zero
          height, same as not rendering it) while keeping its state and
          already-fetched data alive underneath, so switching tabs is an
          instant visibility flip, not a reload. */}
      <View style={[styles.tabContent, activeTab !== "trending" && styles.tabContentHidden]}>
        <NewReleasesRail basePath="/home" />
        <View style={styles.sectionDivider} />

        {/* Trending Movies + Trending Series merged into one rail with
            a movie/series toggle (TrendingRail.tsx), direct ask. */}
        <TrendingRail />
        <View style={styles.sectionDivider} />

        <WhatToWatchRail basePath="/home" />

        {/* One banner at the very end of this tab's own content, not
            between every section — same direct ask as before ("her
            başlık arası da olmasın... direkt en sona eklenebilir"),
            now scoped per tab since there's no longer one single "end
            of the page". Still conditional on `activeTab` even though the
            rails around it stay permanently mounted — an ad SDK load is a
            real network/revenue-accounting cost, unlike the cheap local
            API calls above, so this should only ever fire for the tab
            actually being looked at, not all 3 eagerly on first render. */}
        {activeTab === "trending" && <AdBanner unitId={AD_UNIT_IDS.DISCOVER_BANNER} />}
      </View>

      <View style={[styles.tabContent, activeTab !== "popular" && styles.tabContentHidden]}>
        <ListsSwiper lists={listsPreview} basePath="/home" onSeeAllPress={() => router.push("/home/lists-discover" as any)} />
        <View style={styles.sectionDivider} />

        {/* PosterRevealProvider now scoped to just Reviews — Lists' own
            card (SearchListCard.tsx) has no poster-reveal mechanism at
            all (plain tap-through, no peek/expand state), unlike the
            old ListRailCard.tsx it replaced, which shared this same
            reveal context with Reviews' own cards. */}
        <PosterRevealProvider>
          <ReviewsSwiper reviews={reviewsPreview} basePath="/home" onSeeAllPress={() => router.push("/home/reviews" as any)} />
        </PosterRevealProvider>

        {/* One rail, one heading — mixes member-only community events
            (never the Shares/Media feed, see GroupAnnouncement.js's own
            comment) with "popular community" discovery cards for
            everyone else (buildCommunityRailItems above). Renders
            nothing at all (no title, no divider) when both sources are
            empty, same as every other empty rail on this page. */}
        {communityRailItems.length > 0 ? (
          <>
            <View style={styles.sectionDivider} />
            <CommunityAnnouncementsSwiper items={communityRailItems} />
          </>
        ) : null}

        {activeTab === "popular" && <AdBanner unitId={AD_UNIT_IDS.DISCOVER_BANNER} />}
      </View>

      <View style={[styles.tabContent, activeTab !== "friends" && styles.tabContentHidden]}>
        <ContentRail
          title={t("Friends' Choice")}
          data={friendsChoice}
          keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
          emptyText={t("Nothing trending with friends yet this week.")}
          renderItem={(item, index) => <AddedByCard item={item} rank={index + 1} />}
        />
        <View style={styles.sectionDivider} />

        <ActivitySection onSeeAllPress={() => router.push("/home/activity" as any)} />

        {activeTab === "friends" && <AdBanner unitId={AD_UNIT_IDS.DISCOVER_BANNER} />}
      </View>
    </ScrollView>
  );
}
