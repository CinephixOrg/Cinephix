import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, RefreshControl, StyleSheet } from "react-native";
// From react-native-gesture-handler, not react-native — this ScrollView sits
// between home/index.tsx's outer horizontal pager and this page's own
// horizontal rails (ContentRail, LeaderboardPodium); every scroller in that
// chain needs to share the gesture-handler resolution system or nested
// horizontal swipes break (see home/index.tsx's own comment for the full story).
import { ScrollView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getPopularThisWeek, getPopularWithFriends } from "../../api/feedService";
import { getReviewsFeed } from "../../api/reviewService";
import { getPopularLists } from "../../api/listService";
import ContentRail from "../ContentRail";
import AddedByCard from "../AddedByCard";
import ReviewsSwiper from "../ReviewsSwiper";
import ListsSwiper from "../ListsSwiper";
import LeaderboardPodium from "../LeaderboardPodium";
import ActivitySection from "./ActivitySection";
import WhatToWatchRail from "./WhatToWatchRail";
import { SkeletonRail } from "../Skeleton";
import { PosterRevealProvider } from "../../context/PosterRevealContext";
import type { PopularThisWeekItem, PopularReview, DiscoverListItem } from "../../types";
import { useTheme } from "../../context/ThemeContext";

// "See all" was removed from both rails, then reinstated a round later —
// both routes (home/reviews.tsx, home/lists-discover.tsx) kept working the
// whole time, just briefly unreachable from here. Left at 10 rather than
// reverting to the smaller pre-removal preview counts — a fuller in-place
// preview plus a real "See all" isn't a contradiction.
const REVIEWS_PREVIEW_COUNT = 10;
const LISTS_PREVIEW_COUNT = 10;

// Discover, rebuilt as one continuous scroll instead of a Films/Series/
// Reviews/Lists tab bar — the user's own framing: a "discover" page should
// show everything going on in one page, not force a choice on entry.
// The Most Favorited/Highest Rated/Most Recommended podium
// (LeaderboardPodium.tsx, GET /feed/leaderboard) sits first, above the
// Trending rails — an all-time, content-only complement to their
// This-Week scope (hot right now vs. beloved all-time), not a duplicate.
// One swipeable component hosts all 3 podium lists (not three
// permanently-visible sections — the user found that too repetitive,
// same podium shape shown 3x in a row), with its own round movie/series
// mode toggle. The podium fetches and owns its leaderboard data entirely
// by itself (not passed down as props from this component's own load())
// specifically so that toggle can refetch just the podium on tap, without
// re-running this page's other four sources. A hairline divider separates
// every top-level section on the page.
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
        container: { paddingVertical: 16, flexGrow: 1 },
        // Between every top-level section on the page (podium, each
        // Trending rail, Reviews, Lists) — the user's own explicit ask,
        // distinct from each section's own internal marginBottom.
        sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16, marginBottom: 24 },
      }),
    [colors]
  );

  const [trendingMovies, setTrendingMovies] = useState<PopularThisWeekItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<PopularThisWeekItem[]>([]);
  const [friendsChoice, setFriendsChoice] = useState<PopularThisWeekItem[]>([]);
  const [reviewsPreview, setReviewsPreview] = useState<PopularReview[]>([]);
  const [listsPreview, setListsPreview] = useState<DiscoverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [moviesRes, seriesRes, friendsRes, reviewsRes, listsRes] = await Promise.all([
      getPopularThisWeek(20, "movie"),
      getPopularThisWeek(20, "series"),
      getPopularWithFriends(20), // no type — movies and series mixed in one rail
      getReviewsFeed(1, REVIEWS_PREVIEW_COUNT),
      getPopularLists(LISTS_PREVIEW_COUNT),
    ]);
    setTrendingMovies(moviesRes);
    setTrendingSeries(seriesRes);
    setFriendsChoice(friendsRes);
    setReviewsPreview(reviewsRes.items);
    setListsPreview(listsRes);
  }, []);

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
    >
      <LeaderboardPodium basePath="/home" />
      <View style={styles.sectionDivider} />

      <ContentRail
        title={t("Trending Movies")}
        data={trendingMovies}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing trending yet this week.")}
        renderItem={(item, index) => <AddedByCard item={item} rank={index + 1} />}
      />
      <View style={styles.sectionDivider} />

      <ContentRail
        title={t("Trending Series")}
        data={trendingSeries}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing trending yet this week.")}
        renderItem={(item, index) => <AddedByCard item={item} rank={index + 1} />}
      />
      <View style={styles.sectionDivider} />

      {/* Popular Lists/Popular Reviews moved ahead of Friends' Choice —
          direct ask, new section order top to bottom: podium, trending
          movies, trending series, popular lists, popular reviews, friends'
          choice, friends activity, then the new "What to Watch" rail. */}
      <ListsSwiper lists={listsPreview} basePath="/home" onSeeAllPress={() => router.push("/home/lists-discover" as any)} />
      <View style={styles.sectionDivider} />

      {/* PosterRevealProvider now scoped to just Reviews — Lists' own card
          (SearchListCard.tsx) has no poster-reveal mechanism at all (plain
          tap-through, no peek/expand state), unlike the old ListRailCard.tsx
          it replaced, which shared this same reveal context with Reviews'
          own cards. */}
      <PosterRevealProvider>
        <ReviewsSwiper reviews={reviewsPreview} basePath="/home" onSeeAllPress={() => router.push("/home/reviews" as any)} />
      </PosterRevealProvider>
      <View style={styles.sectionDivider} />

      <ContentRail
        title={t("Friends' Choice")}
        data={friendsChoice}
        keyExtractor={(item) => `${item.content.type}-${item.content.id}`}
        emptyText={t("Nothing trending with friends yet this week.")}
        renderItem={(item, index) => <AddedByCard item={item} rank={index + 1} />}
      />
      <View style={styles.sectionDivider} />

      <ActivitySection onSeeAllPress={() => router.push("/home/activity" as any)} />
      <View style={styles.sectionDivider} />

      <WhatToWatchRail basePath="/home" />
    </ScrollView>
  );
}
