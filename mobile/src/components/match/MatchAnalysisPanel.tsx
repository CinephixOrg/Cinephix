import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
  Image,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MatchRadarChart from "./MatchRadarChart";
import MatchSharedFavorites from "./MatchSharedFavorites";
import PosterCoverflow from "./PosterCoverflow";
import PosterRow from "./PosterRow";
import MutualConnectionsGrid, { SOCIAL_LOCKED_VISIBLE_COUNT } from "./MutualConnectionsGrid";
import LockedUnlockNote from "./LockedUnlockNote";
import MatchVarietyRings from "./MatchVarietyRings";
import MatchActivityFeed from "./MatchActivityFeed";
import MatchTitleBadge from "./MatchTitleBadge";
import MatchCoverCard from "./MatchCoverCard";
import MatchTierRow from "./MatchTierRow";
import MatchSummarySwiper from "./MatchSummarySwiper";
import { genreColor, hexLuminance } from "./CineMatchGenreRing";
import { prefetchMatchAnalysis, getSharedGenreContent, getMutualConnections, getMutualToWatch, type MatchFilters } from "../../api/matchService";
import type { LightweightContent } from "../../api/contentService";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";
import { formatFiveScale } from "../../utils/rating";
import type { SyncCandidate, MatchAnalysis, Connection } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { fonts } from "../../theme/typography";
import { localeUpper } from "../../utils/text";

interface Props {
  candidate: SyncCandidate;
  filters: MatchFilters;
  // The actual width this panel renders within — MatchResultsCloud's own
  // root `wrap` is capped at `cloudWidth` (Math.min(screenWidth-16, 480)),
  // narrower than the full device width, but this panel used to size its
  // cards off the full screen width from its own useWindowDimensions() call,
  // a real mismatch that pushed every card's right edge past the actual
  // visible container. Sourcing it from the parent instead of re-deriving it
  // independently keeps the two from ever disagreeing again.
  containerWidth: number;
  // Set only by SyncAnalysisModal.tsx (a public profile's Sync Score card
  // ⓘ) — threaded through to prefetchMatchAnalysis so the backend applies
  // its own, separate Free/Plus/Premium gate for that entry point.
  // Undefined for the Sync page's own direct use of this panel, which
  // keeps behaving exactly as it always has.
  source?: "profile";
}

// Tall enough for the breakdown card's chart + its always-reserved detail
// area (MatchRadarChart's DETAIL_HEIGHT) to both fit without scrolling, on
// top of the card's own title — the other cards just get a bit more
// breathing room at this height, which is fine for a uniform "post" size.
// Capped against the actual screen height (see MAX_CARD_HEIGHT_RATIO below)
// so this ideal size never overflows a shorter device's screen.
const IDEAL_CARD_HEIGHT = 500;
// Leaves room for the header above the carousel (avatar/name/bio/Follow) and
// the dot row below it, so the whole panel — not just this one card — has a
// realistic chance of fitting a single screen's height on smaller devices.
const MAX_CARD_HEIGHT_RATIO = 0.58;
const CARD_GAP = 12;
// Matches this panel's own `wrap` horizontal padding (16 each side) so one
// card fills exactly the same content width the header above it uses.
const HORIZONTAL_PADDING = 16;
// How long a candidate switch's analysis fetch has to be genuinely slow
// before the "Generating..." spinner is allowed to actually render — a
// prefetched/cached candidate resolves well under this, so the spinner
// never flashes for one at all. See showAnalyzingSpinner below.
const ANALYZING_SPINNER_DELAY_MS = 150;
// Shared Genres card — a genre with more titles than this gets a "See All"
// grid link next to the coverflow instead of relying on one-at-a-time
// swiping alone.
const SEE_ALL_POSTER_THRESHOLD = 20;
const SEE_ALL_COLUMNS = 3;
const SEE_ALL_POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface CardDef {
  key: string;
  title: string;
  render: () => ReactNode;
}

// Same shape as ProfileAnalysesTab.tsx's own local formatCooldown — small
// enough, and specific enough to each screen's own copy, that a shared util
// wasn't worth the cross-feature coupling for four lines.
function formatCooldown(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// The full analysis design revealed below the profile cloud when a bubble is
// tapped — instant/batch data (breakdown, matchInsights) renders immediately
// since it's already on `candidate` from getSyncCandidates; only the AI
// narrative section loads separately, on mount, via the same
// analyzeMatchWithUser call app/user/[id]/index.tsx already uses for its own
// Analyze button (same filters, so the score this narrative is built from
// matches what's already on screen).
//
// One topic per swipeable card (Instagram-multi-post style), snapped via
// `snapToInterval` rather than `pagingEnabled` — cards are narrower than the
// screen (this panel's own content width), and pagingEnabled snaps to the
// ScrollView's own full width instead, which would be wrong here. The
// profile header stays pinned above the carousel, not swiped — it's
// identity/follow chrome, not one of the analysis's own topics.
export default function MatchAnalysisPanel({ candidate, filters, containerWidth, source }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insetsTop = useSafeAreaInsets().top;
  const cardHeight = Math.min(IDEAL_CARD_HEIGHT, screenHeight * MAX_CARD_HEIGHT_RATIO);
  const accountTier = user?.accountTier ?? "free";
  // Free: the deck below is replaced entirely with a single locked-teaser
  // card (see the "locked" card in the cards useMemo). Plus: every card
  // shows, but Shared Genres/Variety/Activity/Social Overlap each truncate
  // their own list behind LockedUnlockNote — Shared Favorites deliberately
  // excluded, per direct ask not to gate it. Premium/dev: nothing locked.
  const isFreeDeck = accountTier === "free";
  const isPlusPartialLock = accountTier === "plus";
  const [analyzing, setAnalyzing] = useState(true);
  // Debounced view of `analyzing` — true only once it's been loading for
  // longer than ANALYZING_SPINNER_DELAY_MS. Switching to a candidate whose
  // analysis was already prefetched/cached (MatchResultsCloud.tsx's own
  // ahead-of-tap prefetch, or simply revisiting one already viewed this
  // session) resolves in a handful of milliseconds — gating the spinner on
  // raw `analyzing` made that read as a real card (the loading state)
  // flashing on screen and vanishing before the actual content underneath
  // it. Genuinely slow loads still show the spinner exactly as before,
  // just past this short grace window instead of instantly.
  const [showAnalyzingSpinner, setShowAnalyzingSpinner] = useState(false);
  useEffect(() => {
    if (!analyzing) {
      setShowAnalyzingSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowAnalyzingSpinner(true), ANALYZING_SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [analyzing]);
  const [analyzeData, setAnalyzeData] = useState<MatchAnalysis | null>(null);
  // Set only when the AI analysis specifically failed on its per-pair
  // cooldown (matchController.js's analyzeMatchWithUser) — a real, expected
  // state (already analyzed this candidate recently), not a generic
  // failure, so the ai-summary card renders a distinct message instead of
  // the generic "No analysis available." fallback.
  const [analysisCooldownRetryAt, setAnalysisCooldownRetryAt] = useState<number | null>(null);
  // Set only when the profile entry point's own weekly quota (Plus tier —
  // analyzeMatchWithUser's source:"profile" gate) is exhausted. A genuinely
  // different situation from the cooldown above (that one means "come back
  // in N minutes"; this one means "upgrade, or wait for next week"), so it
  // gets its own state and its own message rather than reusing
  // analysisCooldownRetryAt's text. Free is blocked before this panel ever
  // mounts (SyncScoreCard.tsx's own ⓘ handler), so this branch in practice
  // only ever fires for Plus.
  const [analysisUpgradeRequired, setAnalysisUpgradeRequired] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Gates every card's own data fetch except the ai-summary card's (which
  // stays eager — it's card 0, always the first thing shown). Before this,
  // selecting a candidate fired every other card's fetch at once —
  // getSharedGenreContent, getMutualConnections, MatchSharedFavorites' own
  // two calls, MatchActivityFeed's, MatchVarietyRings' two getCineGraph
  // calls — up to 8 parallel requests regardless of whether the viewer ever
  // scrolls past the summary card at all. `activeIndex >= 1` (index 1 is
  // always "breakdown", which needs no fetch of its own — reads straight
  // off `candidate.breakdown`, already on hand) is a deliberately simple,
  // single shared gate rather than per-card proximity math keyed to each
  // card's own position in the (conditionally-built) deck — that would need
  // recomputing "which index would this card have" in two places (here and
  // the `cards` useMemo below) with a real risk of the two drifting apart.
  // This groups every later card's fetch together instead of staggering
  // them individually, but still captures the actual win: nothing fires
  // until the viewer shows real intent to browse past the summary, instead
  // of unconditionally on every single selection.
  const shouldLoadExtras = activeIndex >= 1;
  const scrollRef = useRef<ScrollView>(null);
  // Drives MatchTitleBadge's own fade-out live, not through activeIndex —
  // that only updates once a swipe fully settles (onMomentumScrollEnd), so
  // gating the badge on it alone meant it stayed fully visible for the
  // whole drag gesture and only vanished once the next card had already
  // snapped into place, reported as feeling late. Native-driven so it
  // tracks the drag every frame with no JS-thread round trip.
  const scrollX = useRef(new Animated.Value(0)).current;
  // Lets loadMoreMutualConnections (an event handler, not an effect) tell
  // whether it's still resolving for the candidate the user was on when it
  // fired — a candidate switch can land mid-flight, and without this guard
  // the old candidate's page-2 results would land in the new candidate's
  // already-reset mutualConnections array.
  const activeCandidateIdRef = useRef(candidate.user._id);
  const [genreContent, setGenreContent] = useState<Record<string, LightweightContent[]> | null>(null);
  const [genreContentLoading, setGenreContentLoading] = useState(false);
  // "Watch Together" card — titles genuinely sitting in BOTH sides' own
  // to-watch queue right now, not a guessed/recommended overlap. Fetched
  // once in full per candidate, same shape as genreContent above (small
  // enough that pagination would be overkill — a real queue intersection
  // between two people is realistically a handful of titles at most).
  const [mutualToWatch, setMutualToWatch] = useState<LightweightContent[]>([]);
  const [mutualToWatchLoading, setMutualToWatchLoading] = useState(false);
  // Social Overlap card's mutual-connections grid — paginated/appendable
  // (unlike genreContent above, fetched once in full) so scrolling the card
  // can keep loading more from the bottom, Instagram-feed style.
  const [mutualConnections, setMutualConnections] = useState<Connection[]>([]);
  const [mutualPage, setMutualPage] = useState(0);
  const [mutualHasMore, setMutualHasMore] = useState(true);
  const [mutualLoadingMore, setMutualLoadingMore] = useState(false);
  // Distinct from mutualLoadingMore (which only covers *additional* pages
  // once the first one has already landed) — true only while the very
  // first page is in flight. Without this, MutualConnectionsGrid had no way
  // to tell "haven't fetched yet" apart from "fetched, genuinely zero
  // connections" and showed the same "No mutual connections yet." text for
  // both — misleading in the (real, shouldLoadExtras-widened) window between
  // the card becoming visible and its data actually arriving.
  const [mutualInitialLoading, setMutualInitialLoading] = useState(false);
  // A single always-on genre carousel (arrows cycle through) rather than a
  // row of chips — with 10+ shared genres for a long-time user, a wrapped
  // chip row gets crowded fast; a one-at-a-time picker doesn't.
  const [genreIndex, setGenreIndex] = useState(0);
  const genreSlideDir = useRef<1 | -1>(1);
  const genreSlideAnim = useRef(new Animated.Value(1)).current;
  const [selectedPosterId, setSelectedPosterId] = useState<string | null>(null);
  // Tapping the pill shows every shared genre at once, as a static
  // (non-functional — just an overview) grid in the same reserved spot the
  // rating detail normally occupies. Tapping the pill again, an arrow, or
  // any poster/grid entry closes it back.
  const [showAllGenres, setShowAllGenres] = useState(false);
  // A "See All" grid, direct ask — a shared genre like Drama can easily
  // have 50-100+ mutually-rated titles (getSharedGenreContent has no cap),
  // and one-at-a-time coverflow swiping through that many is genuinely bad
  // UX for finding a specific one. Kept additive rather than restructuring
  // the card: the coverflow stays the default browse experience for the
  // common case, this only ever shows once a genre's own count crosses
  // SEE_ALL_POSTER_THRESHOLD.
  const [seeAllPostersVisible, setSeeAllPostersVisible] = useState(false);
  // scaleY (not translateY) — the whole grid grows open from its own
  // vertical center outward, rather than sliding down from above. RN scale
  // transforms are center-origin by default, so no extra transform-origin
  // handling is needed.
  const { opacity: gridOpacity } = useRevealAnimation(showAllGenres ? "shown" : null);

  // Rating VALUES (the star+number under each name) replay their reveal on
  // every distinct poster tap.
  const { opacity: valueOpacity, translateY: valueTranslateY } = useRevealAnimation(selectedPosterId);
  // The "You"/{username} TITLES above them only animate in once, the first
  // time any poster gets selected, then stay put while switching between
  // different posters — keyed on a stable string so useRevealAnimation's
  // underlying effect only re-fires on the null<->selected transition, not
  // on every poster-to-poster change.
  const { opacity: titleOpacity, translateY: titleTranslateY } = useRevealAnimation(selectedPosterId ? "shown" : null);
  // Crossfades with the titles/values block — visible only while nothing
  // else is showing in this reserved area (no poster selected AND the
  // "show all genres" grid isn't open). A real, reported live bug came
  // from an earlier version of this: a hand-rolled Animated.Value whose
  // *consuming JSX* was conditionally unmounted/remounted via a
  // `showAllGenres ? grid : hintWrap` ternary (the grid and hint used to
  // be mutually exclusive branches) — double-tapping the genre pill
  // (open the grid, close it again) unmounted and remounted the hint
  // element, but the hand-rolled effect only re-fired on the
  // `selectedPosterId===null` boundary, not on this remount, so the
  // freshly-remounted element could pick up a stale mid-animation value
  // instead of a clean state, reading as "stuck." Fixed two ways: this
  // now uses the same shared useRevealAnimation hook every other reveal
  // in this feature already uses (a *new* truthy key always replays the
  // animation from scratch, exactly what a clean remount needs), keyed on
  // the actual full condition rather than just selectedPosterId; and the
  // hint element itself is now *always* mounted (opacity-only, matching
  // MatchRadarChart.tsx's own hint — structurally immune to this class of
  // bug, since there's no unmount/remount for its animation to race
  // against) rather than living inside a branch of the grid/hint ternary.
  const { opacity: hintOpacity } = useRevealAnimation(!showAllGenres && !selectedPosterId ? "shown" : null);

  const goToGenre = (dir: 1 | -1, total: number) => {
    genreSlideDir.current = dir;
    setGenreIndex((prev) => (prev + dir + total) % total);
    setShowAllGenres(false);
    setSeeAllPostersVisible(false);
  };

  useEffect(() => {
    genreSlideAnim.setValue(0);
    Animated.timing(genreSlideAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreIndex]);

  // A fresh candidate/filter selection starts the carousel over from the
  // first shared genre rather than wherever it was left on the last one.
  // Also clears the poster selection directly here, not just via the
  // genreIndex effect above — if the new candidate's carousel also happens
  // to land on index 0 (the common case: most candidates start there),
  // setGenreIndex(0) is a same-value no-op that never fires that effect, so
  // without this the previous candidate's selectedPosterId/showAllGenres
  // would leak into the new one's (mismatched) genre content.
  useEffect(() => {
    setGenreIndex(0);
    setSelectedPosterId(null);
    setShowAllGenres(false);
    setSeeAllPostersVisible(false);
  }, [candidate.user._id]);

  // prefetchMatchAnalysis (not analyzeMatchWithUser directly) — if
  // MatchResultsCloud already kicked off this same candidate's analysis
  // ahead of the tap (see its own comment: only the #1-ranked candidate,
  // fired as soon as results load), this joins that same in-flight/
  // resolved request instead of firing a second redundant LLM call; for
  // any other candidate, this is the first call and behaves exactly as
  // analyzeMatchWithUser always did.
  //
  // filtersKey (not `filters` itself) in the dependency array below — same
  // reasoning as MatchResultsCloud.tsx's own prefetch effect: the filters/
  // results pages both stay mounted, so a round trip back to the filters
  // page and back here (without an actual re-search) hands this panel a
  // new `filters` object reference with identical values, and object-
  // identity deps would refire this real (now per-pair-cooldown-gated)
  // network call for no reason.
  const filtersKey = `${filters.type}:${filters.genres.join(",")}:${filters.useCount}:${filters.useAvgRating}`;
  useEffect(() => {
    let cancelled = false;
    setAnalyzing(true);
    setAnalyzeData(null);
    setAnalysisCooldownRetryAt(null);
    setAnalysisUpgradeRequired(false);
    prefetchMatchAnalysis(candidate.user._id, filters, source)
      .then((data) => {
        if (!cancelled) setAnalyzeData(data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        // Two error shapes worth telling the user about specifically:
        // analyzeMatchWithUser's per-(user,target) cooldown (backend
        // matchController.js), and — new — that same endpoint's separate
        // source:"profile" weekly-quota gate. Everything else stays a
        // silent failure (falls through to the generic "No analysis
        // available." text) since there's nothing more useful to say about
        // a transient network/provider error than that. Previously the
        // cooldown branch was empty — a real gap once the cooldown existed
        // at all: a re-visit to an already-analyzed candidate (cache
        // cleared by an app restart) silently showed the same generic text
        // as a genuine failure, no indication it was expected/temporary.
        if (err?.response?.data?.errors?.requiresUpgrade) {
          setAnalysisUpgradeRequired(true);
          return;
        }
        const retryAfterMs = err?.response?.data?.errors?.retryAfterMs;
        if (err?.response?.status === 429 && retryAfterMs) {
          setAnalysisCooldownRetryAt(Date.now() + retryAfterMs);
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, filtersKey, source]);

  const insights = candidate.matchInsights;
  const sharedGenreNames = insights?.sharedGenres?.map((g) => g.genre) ?? [];

  // Tapping a genre inside the "show all genres" overview grid jumps the
  // carousel straight to it (closing the grid, same as the pill's own
  // toggle) instead of the grid being a purely static list — the same
  // destination goToGenre's arrows reach one step at a time, just direct.
  const goToSpecificGenre = (genre: string) => {
    const idx = sharedGenreNames.indexOf(genre);
    if (idx === -1) return;
    genreSlideDir.current = idx >= genreIndex ? 1 : -1;
    setGenreIndex(idx);
    setShowAllGenres(false);
  };

  // Switching genres clears whichever poster was selected in the previous
  // one (a stale selection from Comedy shouldn't carry over once the
  // carousel advances to Drama) — unconditionally to null now, for both
  // branches: PosterCoverflow itself now rests on its own leading empty
  // slot (leadingEmptySlot below) instead of auto-focusing item 0, the
  // same "nothing selected at rest, swipe or tap to reveal something"
  // convention MatchSharedFavorites.tsx/MatchVarietyRings.tsx's own
  // coverflows already use — so this effect and PosterCoverflow's own
  // mount effect now always agree on null, with no ordering-dependent race
  // between them the way there used to be back when this one tried to
  // predict and immediately apply the coverflow's index-0 selection itself.
  useEffect(() => {
    setShowAllGenres(false);
    setSelectedPosterId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreIndex, genreContent, sharedGenreNames.join(",")]);

  // Fetches every shared genre's content at once (see getSharedGenreContent's
  // own doc comment) so advancing the carousel just reveals already-fetched
  // data, no per-genre network call or loading flicker. Gated on
  // shouldLoadExtras — deferred until the viewer has actually moved past
  // the summary card, not fired the instant a candidate is selected.
  useEffect(() => {
    if (sharedGenreNames.length === 0) {
      setGenreContent(null);
      return;
    }
    // Free tier's deck never shows this card at all (isFreeDeck's
    // locked-teaser card replaces it) — no point spending a real network
    // call on content that's never rendered.
    if (!shouldLoadExtras || isFreeDeck) return;
    let cancelled = false;
    setGenreContentLoading(true);
    getSharedGenreContent(candidate.user._id, candidate.contentType, sharedGenreNames)
      .then((data) => {
        if (!cancelled) setGenreContent(data);
      })
      .catch(() => {
        if (!cancelled) setGenreContent(null);
      })
      .finally(() => {
        if (!cancelled) setGenreContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, candidate.contentType, sharedGenreNames.join(","), shouldLoadExtras, isFreeDeck]);

  // "Watch Together" — same shouldLoadExtras/isFreeDeck gate as every other
  // extra card, fetched once per candidate.
  useEffect(() => {
    setMutualToWatch([]);
    if (!shouldLoadExtras || isFreeDeck) return;
    let cancelled = false;
    setMutualToWatchLoading(true);
    getMutualToWatch(candidate.user._id)
      .then((items) => {
        if (!cancelled) setMutualToWatch(items);
      })
      .catch(() => {
        if (!cancelled) setMutualToWatch([]);
      })
      .finally(() => {
        if (!cancelled) setMutualToWatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.user._id, shouldLoadExtras, isFreeDeck]);

  // First page of the mutual-connections grid, fetched once per candidate —
  // same trigger (and same shouldLoadExtras gate) as the
  // getSharedGenreContent effect above. Further pages load on demand via
  // loadMoreMutualConnections as the card scrolls.
  useEffect(() => {
    activeCandidateIdRef.current = candidate.user._id;
    setMutualConnections([]);
    setMutualPage(0);
    setMutualHasMore(true);
    setMutualLoadingMore(false);
    setMutualInitialLoading(false);
    if (!insights?.socialOverlap || insights.socialOverlap.mutualFollowing <= 0) return;
    // Free tier's deck never shows this card at all.
    if (!shouldLoadExtras || isFreeDeck) return;
    let cancelled = false;
    setMutualInitialLoading(true);
    getMutualConnections(candidate.user._id, 1)
      .then(({ items, pagination }) => {
        if (cancelled) return;
        setMutualConnections(items);
        setMutualPage(1);
        setMutualHasMore(pagination ? pagination.page < pagination.pages : false);
      })
      .catch(() => {
        if (!cancelled) setMutualHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setMutualInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.user._id, insights?.socialOverlap?.mutualFollowing, shouldLoadExtras, isFreeDeck]);

  const loadMoreMutualConnections = () => {
    // Plus tier never needs a page past what LockedUnlockNote already shows
    // — no point fetching pages the grid would just slice away again.
    if (isPlusPartialLock && mutualConnections.length >= SOCIAL_LOCKED_VISIBLE_COUNT) return;
    if (mutualLoadingMore || !mutualHasMore) return;
    setMutualLoadingMore(true);
    const nextPage = mutualPage + 1;
    const requestedCandidateId = candidate.user._id;
    getMutualConnections(candidate.user._id, nextPage)
      .then(({ items, pagination }) => {
        // The user may have switched to a different candidate while this
        // page was in flight — the mutualConnections it would append to has
        // already been reset for that new candidate, so applying a stale
        // response here would silently mix the two candidates' connections.
        if (requestedCandidateId !== activeCandidateIdRef.current) return;
        setMutualConnections((prev) => [...prev, ...items]);
        setMutualPage(nextPage);
        setMutualHasMore(pagination ? pagination.page < pagination.pages : false);
      })
      .catch(() => {
        if (requestedCandidateId === activeCandidateIdRef.current) setMutualHasMore(false);
      })
      .finally(() => {
        if (requestedCandidateId === activeCandidateIdRef.current) setMutualLoadingMore(false);
      });
  };

  const parsed = analyzeData?.parsed;
  // Single fade+slide-in of the summary paragraph once it arrives — lighter
  // than AnimatedInsightList's staggered rows, appropriate for one paragraph
  // rather than a list.
  const { opacity: summaryOpacity, translateY: summaryTranslateY } = useRevealAnimation(parsed ? "shown" : null);
  const cardWidth = containerWidth - HORIZONTAL_PADDING * 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // paddingTop bumped 24→44, direct ask: the bottom-most profile
        // bubble in MatchResultsCloud.tsx's own cloud (which idle-drifts a
        // few px below its nominal resting position, MatchCloudBubble's own
        // bobAnim) could land close enough to this panel's own title
        // (MatchTitleBadge) to visually overlap it — more breathing room
        // between the cloud and this panel, not a MatchCloudBubble change.
        wrap: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 44, gap: 20 },
        card: { backgroundColor: colors.base200, borderRadius: 16, padding: 16 },
        cardScroll: { flex: 1 },
        cardScrollCentered: { flexGrow: 1, justifyContent: "center" },
        // The single biggest text in each card — every other label/value
        // inside a card (category names, descriptions, scores) reads one
        // level down from this.
        sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.placeholder, marginBottom: 10, letterSpacing: 0.4 },
        // A single always-on genre "carousel" — a centered pill showing the
        // current genre, with an arrow on each side — instead of a chip row,
        // which gets crowded once a long-time user's match has 10+ shared
        // genres. Color is per-genre (genreColor), border-only ("içini
        // boyama" — never a filled background).
        genreCarouselRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
        genreArrow: { padding: 6 },
        genrePill: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.base100, minWidth: 120, alignItems: "center" },
        genrePillText: { fontSize: 13, fontFamily: fonts.medium },
        genreDetail: { marginTop: 14 },
        genreDetailLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
        genreEmptyText: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18 },
        seeAllPostersLink: { alignSelf: "center", marginTop: 8 },
        watchTogetherHint: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18, marginBottom: 12 },
        seeAllPostersText: { fontSize: 12, fontFamily: fonts.bold, textDecorationLine: "underline" },
        // The See All modal itself — a plain grid, not trying to match the
        // coverflow's own visual language, since this is purely a fast-scan
        // utility for a genre with too many titles to swipe through one at
        // a time (SEE_ALL_POSTER_THRESHOLD).
        seeAllOverlay: { flex: 1, backgroundColor: colors.base100 },
        seeAllHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        seeAllTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        seeAllClose: { padding: 6 },
        seeAllGrid: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },
        seeAllTile: { padding: 4 },
        seeAllPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.base200 },
        seeAllRatingBadge: {
          position: "absolute",
          bottom: 4,
          right: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          backgroundColor: "rgba(0,0,0,0.65)",
          borderRadius: 8,
          paddingHorizontal: 5,
          paddingVertical: 2,
        },
        seeAllRatingText: { color: "#fff", fontFamily: fonts.bold, fontSize: 10 },
        // A thin, fixed-position divider between the poster row and the
        // reserved detail area below it — a plain sibling, not part of
        // posterDetailReserve, so it can never shift regardless of which of
        // that reserve's states (hint / titles+values / all-genres grid) is
        // currently showing.
        posterDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 14, marginBottom: 14 },
        // Always mounted, fixed height — reserves the same space regardless
        // of which of the 4 states (hint / titles+values / all-genres grid)
        // is showing, so the poster row above never shifts (same principle
        // as MatchRadarChart's own detailReserve). Sized generously against
        // the worst case: all-genres grid with the maximum real shared-genre
        // count (19 for movies) still fitting without its own scroll.
        posterDetailReserve: { height: 184, position: "relative" },
        // `bottom` trimmed on both the hint and the detail (not just the
        // full absoluteFill's 0) so the vertically-centered content sits
        // noticeably higher than dead-center, per direct feedback that the
        // poster detail info sat too low — kept equal on both so the hint
        // and a selected poster's detail still line up in the same spot as
        // they cross-fade, rather than jumping between two different
        // vertical positions.
        posterHintWrap: { ...StyleSheet.absoluteFill, bottom: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
        posterHint: { fontSize: 11, fontStyle: "italic", color: colors.placeholder, textAlign: "center", lineHeight: 16 },
        posterDetail: {
          ...StyleSheet.absoluteFill,
          bottom: 44,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
        },
        // The focused poster's own title/name — the coverflow (PosterCoverflow)
        // doesn't show a title under each poster the way PosterRow does, so
        // this replaces that lost information rather than just being decorative.
        posterDetailTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent, textAlign: "center" },
        posterDetailRatingsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 24 },
        // maxWidth caps each column so a long username truncates ("...")
        // rather than overflowing or squeezing the star+number next to it.
        ratingColumn: { alignItems: "center", gap: 8, maxWidth: "45%" },
        ratingName: {
          fontFamily: fonts.bold,
          fontSize: 14,
          textAlign: "center",
          letterSpacing: 0.5,
        },
        ratingUnit: { flexDirection: "row", alignItems: "center", gap: 6 },
        ratingText: { fontSize: 15, fontFamily: fonts.medium, color: colors.baseContent },
        ratingMuted: { fontSize: 12.5, fontStyle: "italic", color: colors.placeholder },
        // The "all shared genres at once" overview — border-colored pills
        // per genre like the main carousel pill, tappable: picking one jumps
        // the carousel straight to it and closes the overview (goToSpecificGenre),
        // same destination the pill/arrows already reach a step at a time.
        genreGridWrap: {
          ...StyleSheet.absoluteFill,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignContent: "flex-start",
          gap: 5,
          paddingHorizontal: 4,
          paddingTop: 32,
        },
        genreGridChip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
        genreGridChipText: { fontSize: 9.5, fontFamily: fonts.medium },
        narrativeLoading: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
        narrativeLoadingText: { fontSize: 13, color: colors.placeholder },
        // Centered, matching every other card's own detail/description text
        // (MatchRadarChart's detailDesc, Shared Genres' detail text, etc.).
        summaryContent: { alignItems: "center" },
        paragraph: { fontSize: 14, color: colors.baseContent, lineHeight: 20, textAlign: "center" },
        upgradeLink: { color: colors.primary, fontFamily: fonts.bold, marginTop: 8 },
        dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
        dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
        dotActive: { width: 18, backgroundColor: colors.primary },
        freeLockedWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 10 },
        freeLockedTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent, textAlign: "center" },
        freeLockedText: { fontSize: 13, color: colors.placeholder, textAlign: "center", lineHeight: 19 },
        freeLockedButton: { marginTop: 10, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12 },
        freeLockedButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
      }),
    [colors]
  );

  const cards = useMemo<CardDef[]>(() => {
    // AI-derived cards lead the deck — a qualitative synthesis of everything
    // the other cards (Taste/Shared Genres/Favorites/Social) measure
    // quantitatively, so it reads better first than last. Each piece is its
    // own card (was one long scrolling card with 4 stacked sections) to
    // match this feature's established "one topic per card" model.
    // Captured as plain arrays (not re-read via `parsed?.x` inside the
    // render closure below) so TS can actually narrow them — `parsed` itself
    // stays possibly-undefined from that closure's point of view otherwise,
    // even though the outer `parsed ?` check already guards it.
    const strengths = parsed?.strengths ?? [];
    const weaknesses = parsed?.weaknesses ?? [];
    const conversationStarters = parsed?.conversation_starters ?? [];

    const list: CardDef[] = [
      {
        key: "ai-summary",
        title: t("Sync Summary"),
        render: () =>
          showAnalyzingSpinner ? (
            <View style={styles.narrativeLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.narrativeLoadingText}>{t("Generating your compatibility analysis...")}</Text>
            </View>
          ) : parsed ? (
            <Animated.View style={[styles.summaryContent, { opacity: summaryOpacity, transform: [{ translateY: summaryTranslateY }] }]}>
              <MatchTierRow candidate={candidate} />
              <MatchSummarySwiper analysis={parsed.analysis} strengths={strengths} weaknesses={weaknesses} conversationStarters={conversationStarters} />
            </Animated.View>
          ) : analyzing ? null : analysisUpgradeRequired ? (
            <View>
              <Text style={styles.paragraph}>{t("You've used all your sync analyses for this week. Upgrade to Premium for unlimited access.")}</Text>
              <Pressable onPress={() => router.push("/match/subscription" as any)} hitSlop={8}>
                <Text style={[styles.paragraph, styles.upgradeLink]}>{t("Upgrade")}</Text>
              </Pressable>
            </View>
          ) : analysisCooldownRetryAt ? (
            <Text style={styles.paragraph}>
              {t("You've already analyzed this match recently. A new analysis will be available in {{time}}.", {
                time: formatCooldown(analysisCooldownRetryAt - Date.now()),
              })}
            </Text>
          ) : (
            <Text style={styles.paragraph}>{t("No analysis available.")}</Text>
          ),
      },
    ];

    // Free tier: everything between the summary and the closing Share card
    // is replaced with one locked-teaser card — Plus/Premium/dev fall
    // through to the full deck below, each middle card individually
    // truncated for Plus (see each card's own `locked` prop).
    if (isFreeDeck) {
      list.push({
        key: "locked",
        title: t("Full Details"),
        render: () => (
          <View style={styles.freeLockedWrap}>
            <Ionicons name="lock-closed" size={28} color={colors.placeholder} />
            <Text style={styles.freeLockedTitle}>{t("Unlock the full breakdown")}</Text>
            <Text style={styles.freeLockedText}>
              {t("Shared genres, favorites, variety, activity, and social overlap are available on Plus and Premium.")}
            </Text>
            <Pressable style={styles.freeLockedButton} onPress={() => router.push("/match/subscription" as any)}>
              <Text style={styles.freeLockedButtonText}>{t("See Plans")}</Text>
            </Pressable>
          </View>
        ),
      });

      list.push({
        key: "cover",
        title: t("Share"),
        render: () => <MatchCoverCard candidate={candidate} analysis={analyzeData} />,
      });

      return list;
    }

    list.push({
      key: "breakdown",
      title: t("Sync Breakdown"),
      render: () => <MatchRadarChart breakdown={candidate.breakdown} candidateId={candidate.user._id} />,
    });

    // Plus tier — only the first N shared genres are browsable; Premium/dev
    // get the full list. This narrows what the carousel below cycles
    // through (total, currentGenre, the "show all" grid) all at once, so
    // there's no separate slicing needed further down.
    const visibleSharedGenres =
      isPlusPartialLock && insights?.sharedGenres ? insights.sharedGenres.slice(0, 5) : insights?.sharedGenres;
    const hiddenGenreCount = (insights?.sharedGenres?.length ?? 0) - (visibleSharedGenres?.length ?? 0);

    if (visibleSharedGenres?.length) {
      const total = visibleSharedGenres.length;
      const genreBgLuminance = hexLuminance(colors.base100);
      const currentIndex = ((genreIndex % total) + total) % total;
      const currentGenre = visibleSharedGenres[currentIndex].genre;
      const currentColor = genreColor(currentIndex, total, genreBgLuminance);
      const currentCount = genreContent?.[currentGenre]?.length;
      const genreItems = genreContent?.[currentGenre];
      const selectedItem = genreItems?.find((i) => i._id === selectedPosterId);
      const hintText = t("Swipe or tap a poster to compare ratings, or the genre button above to see them all.");

      list.push({
        key: "genres",
        title: t("Shared Genres"),
        render: () => (
          <View>
            <View style={styles.genreCarouselRow}>
              <Pressable style={styles.genreArrow} onPress={() => goToGenre(-1, total)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={colors.baseContent} />
              </Pressable>
              <Pressable
                style={[styles.genrePill, { borderColor: currentColor }, showAllGenres && { backgroundColor: currentColor }]}
                onPress={() => setShowAllGenres((prev) => !prev)}
              >
                <Animated.Text
                  style={[
                    styles.genrePillText,
                    { color: showAllGenres ? "#2b2b2b" : currentColor },
                    {
                      opacity: genreSlideAnim,
                      transform: [
                        {
                          translateX: genreSlideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [genreSlideDir.current * 16, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {currentGenre}
                  {currentCount != null ? ` · ${currentCount}` : ""}
                </Animated.Text>
              </Pressable>
              <Pressable style={styles.genreArrow} onPress={() => goToGenre(1, total)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color={colors.baseContent} />
              </Pressable>
            </View>

            <View style={styles.genreDetail}>
              {genreContentLoading ? (
                <View style={styles.genreDetailLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.narrativeLoadingText}>{t("Loading")}</Text>
                </View>
              ) : genreItems?.length ? (
                <>
                  {/* Always the coverflow now, regardless of item count —
                      the tap-based PosterRow fallback used to kick in
                      below a minimum item count, but per direct ask the
                      scroll interaction should behave identically no
                      matter how few posters a genre has. */}
                  <PosterCoverflow
                    // Remounts on every genre switch — resets the
                    // coverflow's internal scroll position, which
                    // otherwise has no way to know the underlying items
                    // changed out from under it.
                    key={currentGenre}
                    items={genreItems}
                    onFocusChange={(id) => {
                      setShowAllGenres(false);
                      setSelectedPosterId(id);
                    }}
                    leadingEmptySlot
                  />
                  {genreItems.length > SEE_ALL_POSTER_THRESHOLD && (
                    <Pressable style={styles.seeAllPostersLink} onPress={() => setSeeAllPostersVisible(true)}>
                      <Text style={[styles.seeAllPostersText, { color: currentColor }]}>
                        {t("See all {{count}}", { count: genreItems.length })}
                      </Text>
                    </Pressable>
                  )}
                  <View style={styles.posterDivider} />
                  <View style={styles.posterDetailReserve}>
                    {/* Always mounted, opacity-only — see the hintOpacity
                        comment above for why this can no longer live
                        inside a branch of a showAllGenres ternary. */}
                    <Animated.View style={[styles.posterHintWrap, { opacity: hintOpacity }]} pointerEvents="none">
                      <Text style={styles.posterHint}>{hintText}</Text>
                    </Animated.View>

                    {showAllGenres && (
                      <Animated.View style={[styles.genreGridWrap, { opacity: gridOpacity, transform: [{ scaleY: gridOpacity }] }]}>
                        {visibleSharedGenres.map((g, i) => {
                          const c = genreColor(i, total, genreBgLuminance);
                          return (
                            <Pressable key={g.genre} onPress={() => goToSpecificGenre(g.genre)} style={[styles.genreGridChip, { borderColor: c }]}>
                              <Text style={[styles.genreGridChipText, { color: c }]}>{g.genre}</Text>
                            </Pressable>
                          );
                        })}
                      </Animated.View>
                    )}
                    {hiddenGenreCount > 0 && (
                      <LockedUnlockNote
                        label={t("Showing {{shown}} of {{total}}", { shown: total, total: total + hiddenGenreCount })}
                      />
                    )}

                    {!showAllGenres && selectedPosterId && (
                      <Animated.View style={[styles.posterDetail, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}>
                        <Animated.Text
                          style={[styles.posterDetailTitle, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {selectedItem?.title ?? selectedItem?.name ?? ""}
                        </Animated.Text>
                        <View style={styles.posterDetailRatingsRow}>
                          <View style={styles.ratingColumn}>
                            <Text style={[styles.ratingName, { color: currentColor }]} numberOfLines={1} ellipsizeMode="tail">
                              {localeUpper(t("You"))}
                            </Text>
                            {selectedItem?.myRating != null ? (
                              <Animated.View style={[styles.ratingUnit, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}>
                                <Ionicons name="star" size={16} color={colors.warning} />
                                <Text style={styles.ratingText}>{formatFiveScale(selectedItem.myRating)}</Text>
                              </Animated.View>
                            ) : (
                              <Animated.Text
                                style={[styles.ratingMuted, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}
                              >
                                {t("Not rated yet")}
                              </Animated.Text>
                            )}
                          </View>
                          <View style={styles.ratingColumn}>
                            <Text style={[styles.ratingName, { color: currentColor }]} numberOfLines={1} ellipsizeMode="tail">
                              {localeUpper(candidate.user.username)}
                            </Text>
                            {selectedItem?.targetRating != null ? (
                              <Animated.View style={[styles.ratingUnit, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}>
                                <Ionicons name="star" size={16} color={colors.warning} />
                                <Text style={styles.ratingText}>{formatFiveScale(selectedItem.targetRating)}</Text>
                              </Animated.View>
                            ) : (
                              <Animated.Text
                                style={[styles.ratingMuted, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}
                              >
                                {t("Not rated yet")}
                              </Animated.Text>
                            )}
                          </View>
                        </View>
                      </Animated.View>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.genreEmptyText}>
                  {t("Neither of you has rated anything in {{genre}} yet.", { genre: currentGenre })}
                </Text>
              )}
            </View>

            <Modal visible={seeAllPostersVisible} animationType="slide" onRequestClose={() => setSeeAllPostersVisible(false)}>
              <View style={[styles.seeAllOverlay, { paddingTop: insetsTop }]}>
                <View style={styles.seeAllHeader}>
                  <Text style={styles.seeAllTitle}>{currentGenre}</Text>
                  <Pressable style={styles.seeAllClose} onPress={() => setSeeAllPostersVisible(false)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.baseContent} />
                  </Pressable>
                </View>
                <FlatList
                  data={genreItems ?? []}
                  keyExtractor={(item) => item._id}
                  numColumns={SEE_ALL_COLUMNS}
                  contentContainerStyle={styles.seeAllGrid}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.seeAllTile, { width: screenWidth / SEE_ALL_COLUMNS }]}
                      onPress={() => {
                        setSelectedPosterId(item._id);
                        setShowAllGenres(false);
                        setSeeAllPostersVisible(false);
                      }}
                    >
                      <View>
                        {item.poster_path ? (
                          <Image source={{ uri: `${SEE_ALL_POSTER_BASE}${item.poster_path}` }} style={styles.seeAllPoster} />
                        ) : (
                          <View style={styles.seeAllPoster} />
                        )}
                        {item.myRating != null && (
                          <View style={styles.seeAllRatingBadge}>
                            <Ionicons name="star" size={9} color={colors.warning} />
                            <Text style={styles.seeAllRatingText}>{formatFiveScale(item.myRating)}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            </Modal>
          </View>
        ),
      });
    }

    // "Watch Together" — genuinely sitting on BOTH sides' own to-watch
    // queue right now (getMutualToWatch), not a recommendation guess.
    // Omitted entirely when there's no real overlap, same rule every other
    // card here follows — no "nothing in common yet" empty state to build.
    if (!mutualToWatchLoading && mutualToWatch.length > 0) {
      list.push({
        key: "watch-together",
        title: t("Watch Together"),
        render: () => (
          <View>
            <Text style={styles.watchTogetherHint}>
              {t("Already on both your watchlists — you could sync up and watch these together.")}
            </Text>
            <PosterRow items={mutualToWatch} />
          </View>
        ),
      });
    }

    const fav = insights?.favoritesOverlap;
    if (fav && (fav.sharedIds?.length || fav.genreOnly?.mine?.length || fav.genreOnly?.theirs?.length)) {
      list.push({
        key: "favorites",
        title: t("Shared Favorites"),
        render: () => (
          <MatchSharedFavorites
            targetUserId={candidate.user._id}
            contentType={candidate.contentType}
            sharedIds={fav.sharedIds}
            genreOnlyMineIds={fav.genreOnly?.mine ?? []}
            genreOnlyTheirsIds={fav.genreOnly?.theirs ?? []}
            targetUsername={candidate.user.username}
            shouldLoad={shouldLoadExtras}
          />
        ),
      });
    }

    list.push({
      key: "variety",
      title: t("Variety"),
      render: () => (
        <MatchVarietyRings candidate={candidate} activeGenres={filters.genres} shouldLoad={shouldLoadExtras} locked={isPlusPartialLock} />
      ),
    });

    list.push({
      key: "activity",
      title: t("Activity"),
      render: () => <MatchActivityFeed candidate={candidate} shouldLoad={shouldLoadExtras} locked={isPlusPartialLock} />,
    });

    // Pushed whenever socialOverlap was actually computed (basically
    // always, once matchInsights exists at all) — no longer gated on
    // mutualFollowing > 0, which used to make the whole card vanish for
    // zero mutual connections instead of showing an empty state the way
    // every other card in this deck already does for its own "nothing
    // here" case.
    if (insights?.socialOverlap) {
      list.push({
        key: "social",
        title: t("Social Overlap"),
        render: () => (
          <MutualConnectionsGrid
            items={mutualConnections}
            loadingMore={mutualLoadingMore}
            initialLoading={mutualInitialLoading}
            locked={isPlusPartialLock}
          />
        ),
      });
    }

    // The deck's own closing card, always last regardless of what else made
    // the cut above — a share prompt needs the analysis to already be
    // loaded (analyzeData), not gated behind any of the per-candidate
    // insight checks the cards above it use.
    list.push({
      key: "cover",
      title: t("Share"),
      render: () => <MatchCoverCard candidate={candidate} analysis={analyzeData} />,
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    candidate,
    filters,
    insights,
    analyzing,
    showAnalyzingSpinner,
    analyzeData,
    analysisCooldownRetryAt,
    shouldLoadExtras,
    parsed,
    t,
    colors,
    genreIndex,
    genreContent,
    genreContentLoading,
    selectedPosterId,
    genreSlideAnim,
    hintOpacity,
    titleOpacity,
    titleTranslateY,
    valueOpacity,
    valueTranslateY,
    showAllGenres,
    gridOpacity,
    seeAllPostersVisible,
    screenWidth,
    insetsTop,
    mutualToWatch,
    mutualToWatchLoading,
    mutualConnections,
    mutualLoadingMore,
    mutualInitialLoading,
    summaryOpacity,
    summaryTranslateY,
    isFreeDeck,
    isPlusPartialLock,
    router,
  ]);

  // A fresh candidate starts the card deck over at "Sync Summary" (index 0)
  // rather than wherever the previous candidate's deck was left scrolled to
  // — same "start over, don't carry position across candidates" precedent
  // as the shared-genre carousel above. Non-animated: this is a brand-new
  // deck appearing, not a user-driven navigation.
  //
  // scrollX.setValue(0) is the real fix here, not just belt-and-suspenders:
  // scrollRef.current.scrollTo({x:0, animated:false}) moves the native
  // ScrollView, but a non-animated programmatic scrollTo doesn't reliably
  // re-fire onScroll on every platform — when it doesn't, the
  // Animated.event binding above (scrollX) never hears about the jump and
  // stays stuck at whatever position the PREVIOUS candidate's deck was
  // scrolled to. MatchTitleBadge reads scrollX directly (not activeIndex,
  // per its own comment below) to fade itself in/out, so a stale non-zero
  // scrollX after switching candidates rendered it as still-faded-out even
  // though the deck had visibly snapped back to card 0 — a real, reported
  // bug ("2nd+ switch to a different profile, the first card's LLM title
  // doesn't load"; a genuine swipe always fixes it because a real drag
  // gesture DOES reliably fire onScroll, which is exactly why it only ever
  // reproduced through this programmatic reset path). Setting the Animated
  // value directly guarantees it agrees with the visual reset regardless of
  // whether the platform happens to fire that onScroll or not.
  useEffect(() => {
    setActiveIndex(0);
    scrollX.setValue(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [candidate.user._id, scrollX]);

  // Clamp — a fresh candidate/filter selection can shrink the deck (fewer
  // cards this time) while the previous selection's scroll position is still
  // in flight, so the dot row and scrollTo target must never point past the
  // new deck's own last index.
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, cards.length - 1));
  }, [cards.length]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(cards.length - 1, idx)));
  };

  // "Instagram feed" behavior for the Social Overlap card: scrolling down
  // near the bottom of the card's own (already-existing, per-card) vertical
  // ScrollView loads the next page and appends it, rather than opening a
  // separate followers-style list screen.
  const onSocialCardScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 80) {
      loadMoreMutualConnections();
    }
  };

  const goToCard = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * (cardWidth + CARD_GAP), animated: true });
    setActiveIndex(index);
  };

  return (
    <View style={styles.wrap}>
      <View>
        {/* Animated.ScrollView, not the plain ScrollView every other
            scroller in this file uses — Animated.event's returned
            AnimatedEvent is a plain object, not a callable function; only
            an Animated.createAnimatedComponent-wrapped component (which
            Animated.ScrollView is) knows to detect and specially attach
            it. Passed to a plain ScrollView, RN forwards that raw object
            straight through as the literal onScroll prop, and its
            internal _handleScroll blindly calls `this.props.onScroll(e)`
            — a real "Object is not a function" crash on every scroll
            frame, not a red herring. */}
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onScrollEnd}
          contentContainerStyle={{ gap: CARD_GAP }}
        >
          {cards.map((card) => (
            <View key={card.key} style={[styles.card, { width: cardWidth, height: cardHeight }]}>
              {/* "cover" excluded too, alongside "ai-summary" — MatchCoverCard
                  already renders its own title (MatchGradientTitle, "Ready to
                  share your Sync?") as the first line of its own centered
                  content. This external "SHARE" heading was redundant with
                  that AND, worse, ate real height from the top of the box
                  before cardScrollCentered's own centering ever runs — so
                  the actually-centered content below it landed visibly lower
                  than the card's true middle, direct report even after
                  "cover" was added to cardScrollCentered. Removing it lets
                  MatchCoverCard's whole content (title included) center as
                  one group in the full card height. */}
              {card.key !== "ai-summary" && card.key !== "cover" && <Text style={styles.sectionTitle}>{localeUpper(card.title)}</Text>}
              {/* cardScrollCentered (flexGrow:1 + justifyContent:"center")
                  vertically centers a card whose own content is naturally
                  shorter than this shared fixed `cardHeight` — without it,
                  a short card's content just sits at the top with empty
                  space below, which for "cover" (MatchCoverCard, the
                  closing Share card — reliably one of the shortest, no
                  chart/rail of its own) read as the card having "slid
                  down" / its Share button rendering cut off at the bottom
                  of a mostly-empty box. "breakdown" already had this fix;
                  "cover" was the one other card genuinely short enough to
                  need it too — direct report, not fixed until now. */}
              <ScrollView
                style={styles.cardScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={card.key === "breakdown" || card.key === "cover" ? styles.cardScrollCentered : undefined}
                onScroll={card.key === "social" ? onSocialCardScroll : undefined}
                scrollEventThrottle={card.key === "social" ? 200 : undefined}
              >
                {card.render()}
              </ScrollView>
            </View>
          ))}
        </Animated.ScrollView>

        {cards.length > 1 && (
          <View style={[styles.dotsRow, { marginTop: 12 }]}>
            {cards.map((card, i) => (
              <Pressable key={card.key} onPress={() => goToCard(i)} hitSlop={8}>
                <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Rendered outside the horizontal ScrollView entirely, not as a
            per-card child — that ScrollView's own viewport clips to
            cardHeight (its cross-axis size is driven by the tallest
            card), and this badge is centered exactly ON the card's top
            edge (MatchTitleBadge.tsx), meaning half of it necessarily
            renders above y:0 — inside the ScrollView, that half was
            silently clipped away (read as "stuck behind the page" again).
            A paging ScrollView always presents its active card starting
            right at the viewport's own left edge, so positioning this at
            left:0 of this unclipped sibling View — which shares the same
            width as a card, since wrap's own horizontal padding already
            produced that width — lines it up with the ai-summary card
            whenever that card is the one on screen.

            Deliberately mounted for as long as `parsed.match_title`
            exists — NOT gated on `cards[activeIndex]?.key === "ai-summary"`
            the way it briefly was. That gate depends on `activeIndex`,
            which only updates in `onMomentumScrollEnd` — an event iOS/
            Android don't reliably fire for every gesture (a slow drag
            released exactly on a snap point, with no residual momentum,
            can end via onScrollEndDrag alone) — so mounting/unmounting on
            it was flaky: swiping back to this card sometimes never
            remounted the badge at all. It also meant every return replayed
            MatchTitleBadge's own stamp-in entrance, when that's only
            supposed to play once per candidate's analysis loading in, not
            on every swipe back to this card. Staying mounted continuously
            fixes both: visibility while scrolled to another card is
            entirely `scrollX`-driven (dragOpacity, inside
            MatchTitleBadge.tsx) rather than tied to this flaky event, and
            since the component itself never remounts on a same-candidate
            return, its own entrance effect (keyed on `text`) has nothing
            to re-trigger — it only replays when match_title itself
            actually changes, i.e. a real candidate switch. */}
        {parsed?.match_title ? (
          <MatchTitleBadge text={parsed.match_title} gradientId="matchTitleBadgeGradient" scrollX={scrollX} />
        ) : null}
      </View>
    </View>
  );
}
