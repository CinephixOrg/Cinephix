import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import Pressable from "../components/common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAnalysisCards } from "../components/profile/ProfileAnalysisCardDeck";
import { hexLuminance } from "../components/match/CineMatchGenreRing";
import ShareOptionsMenu from "../components/ShareOptionsMenu";
import UserSharePickerModal from "../components/UserSharePickerModal";
import TutorialSpotlight from "../components/tutorial/TutorialSpotlight";
import TutorialInfoBox from "../components/tutorial/TutorialInfoBox";
import { takePendingProfileAnalysis } from "../utils/pendingProfileAnalysis";
import { createShare } from "../api/shareService";
import { getOrCreateConversation, sendMessageRest, sendRichMessage } from "../api/conversationService";
import { sendGroupMessageRest, sendGroupRichMessage } from "../api/groupService";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useRecentShares } from "../context/RecentSharesContext";
import { useToast } from "../context/ToastContext";
import { useComposeTutorial } from "../context/ComposeTutorialContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import type { ProfileAnalysis, ProfileAnalysisItem } from "../types";

const HORIZONTAL_PADDING = 18;
const IDEAL_CARD_HEIGHT = 540;
const MAX_CARD_HEIGHT_RATIO = 0.64;
// Direct ask — dense analysis content, not a quick pitch slide like
// SyncIntroStory.tsx's own 4.2s, so this needs real reading time (30-50s
// range given); 40s picked as the concrete value. The user can always move
// on manually by swiping regardless.
const SLIDE_MS = 40000;

// Entry point: reads the one-shot staged analysis (set by
// AnalyzeInfoModal.tsx for a fresh result, app/(app)/profile/analyses.tsx
// for a tapped history entry, or ShareCard.tsx/ChatRoom.tsx for a shared/
// received one) and bounces back if there's genuinely nothing to show
// (e.g. a stray deep link). Split from the real content component below so
// useAnalysisCards — and every other hook this screen needs — is only ever
// called once `data` is guaranteed non-null, never conditionally.
//
// Duplicated into every tab stack that can open a shared analysis (see
// app/(app)/home/analyze-story.tsx, app/(app)/socials/analyze-story.tsx,
// app/user/[id]/analyze-story.tsx, plus the original
// app/(app)/profile/analyze-story.tsx), each a one-line re-export of this
// file — same pattern ContentDetailScreen.tsx already established for
// content/[type]/[id].tsx across 8 stacks.
export default function AnalyzeStoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [pending] = useState(() => takePendingProfileAnalysis());

  useEffect(() => {
    if (!pending) router.back();
  }, [pending, router]);

  if (!pending) {
    return <View style={{ flex: 1, backgroundColor: colors.base100 }} />;
  }

  return <AnalyzeStoryContent data={pending.data} origin={pending.origin} />;
}

function AnalyzeStoryContent({ data, origin }: { data: ProfileAnalysis; origin: "own" | "shared" }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { announce: announceNewShare } = useRecentShares();
  const { showToast } = useToast();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Mirrors ContentDetailScreen.tsx's own derivation exactly: "which tab's
  // stack is this screen currently running under" straight from the URL,
  // since this screen is duplicated into every tab (see the re-export
  // files listed above) with no basePath prop of its own.
  const pathname = usePathname();
  const basePath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "user" && segments[1]) return `/user/${segments[1]}`;
    return segments[0] ? `/${segments[0]}` : "/profile";
  }, [pathname]);

  // Last step of the "Analyze" compose-tutorial walkthrough (Shares' "+"
  // menu → Profile's own header button → here) — advances itself the
  // moment this screen opens, same reasoning ProfileAnalysisModal.tsx's own
  // identical effect already had. Only relevant to the owner's own flow.
  const { tutorial: composeTutorial, setAnalyzeStep, endTutorial: endComposeTutorial } = useComposeTutorial();
  useEffect(() => {
    if (origin === "own" && composeTutorial?.id === "analyze") setAnalyzeStep("tapShare");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showShareTutorial = origin === "own" && composeTutorial?.id === "analyze" && composeTutorial.step === "tapShare";

  const bgLuminance = useMemo(() => hexLuminance(colors.base100), [colors.base100]);

  // Per-card selection (which genre/rating/month a chart has focused)
  // lives in a plain ref, not state — unlike the old modal-based deck,
  // this screen never unmounts while the viewer is away on a title's own
  // page (a normal pushed route stays mounted underneath), so there's no
  // cross-remount persistence to engineer here at all.
  const selectionByCardRef = useRef<Record<string, string | null>>({});
  const selectionFor = useCallback((key: string) => selectionByCardRef.current[key] ?? null, []);
  const selectHandlersRef = useRef(new Map<string, (next: string | null) => void>());
  const selectFor = useCallback((key: string) => {
    let handler = selectHandlersRef.current.get(key);
    if (!handler) {
      handler = (next: string | null) => {
        selectionByCardRef.current[key] = next;
      };
      selectHandlersRef.current.set(key, handler);
    }
    return handler;
  }, []);

  // A normal push under the correct tab's own stack, so tapping through to
  // a title's page and back just works via that stack's navigator — no
  // screenFocused-gated "hide without closing" trick needed, and (now that
  // basePath resolves to the right stack) no longer limited to the owner's
  // own flow either: a poster inside a shared analysis navigates exactly
  // the same way.
  const handleOpenItem = useCallback(
    (item: ProfileAnalysisItem) => {
      router.push(`${basePath}/content/${item.type}/${item._id}` as never);
    },
    [router, basePath]
  );
  // Settings only exists under the Profile stack regardless of which tab
  // this screen is running in — same as ProfileAnalysisModal.tsx's own
  // always-hardcoded handleUpgrade.
  const handleUpgrade = useCallback(() => {
    router.push("/profile/settings" as any);
  }, [router]);

  // viewerTier is always the current logged-in viewer's own tier, exactly
  // as ProfileAnalysisModal.tsx already passed it — analysisCardAccess.ts's
  // own ANALYSIS_CARD_MIN_TIER is all "free" today (a deliberately inert
  // gate), so this never re-filters a shared analysis's cards by the
  // viewer's tier: it keeps showing whatever the data contains, decided by
  // the original owner's tier at generation time.
  const cards = useAnalysisCards({
    data,
    viewerTier: user?.accountTier,
    bgLuminance,
    onUpgrade: handleUpgrade,
    onOpenItem: handleOpenItem,
    selectionFor,
    selectFor,
    // Direct report: a viewer of someone ELSE's shared analysis has no use
    // for an "Upgrade to unlock" tease card — upgrading their own account
    // can't retroactively add Rating Curve/Watch Timeline to a friend's
    // already-generated result. Only the owner's own flow shows it.
    showPremiumTease: origin === "own",
  });

  const [index, setIndex] = useState(0);
  const [revealedKeys, setRevealedKeys] = useState<string[]>([]);
  const progress = useRef(cards.map(() => new Animated.Value(0))).current;
  const scrollRef = useRef<GHScrollView>(null);
  // A horizontal ScrollView doesn't reliably hand its own measured height
  // down to flex:1 children in its content — that's the real cause behind
  // a direct bug report ("aşağı kaydırıyorum ama kaymıyor"): each page's
  // inner vertical scroller was resolving to a near-zero height, so it had
  // nothing to actually scroll within and its own pager arrows sat outside
  // the visible area. Measuring the pager's own real height here and
  // passing it down as an explicit `height` (not `flex:1`) on each page
  // fixes it — same onLayout-measure-then-use pattern
  // ProfileAnalysisModal.tsx's own `handleDeckLayout`/`deckWidth` already
  // uses for the identical reason.
  const [pagerHeight, setPagerHeight] = useState(0);
  const isLast = index === cards.length - 1;

  useEffect(() => {
    const key = cards[index]?.key;
    if (!key) return;
    setRevealedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, [index, cards]);

  // Direct ask: navigation between slides is a swipe gesture now, not a
  // tap — this scrolls the real paging ScrollView below rather than
  // cross-fading a single shown card. `onScrollSettled` is the manual-
  // swipe half (fires on drag release); this is the auto-advance half.
  const goToIndex = (next: number) => {
    if (next < 0 || next >= cards.length) return;
    scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    setIndex(next);
  };

  const onScrollSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setIndex((prev) => (prev === next ? prev : next));
  };

  useEffect(() => {
    progress.forEach((pv, i) => {
      if (i < index) pv.setValue(1);
      else if (i > index) pv.setValue(0);
    });
    if (isLast) {
      progress[index]?.setValue(1);
      return;
    }
    progress[index]?.setValue(0);
    const anim = Animated.timing(progress[index], { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) goToIndex(index + 1);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cards.length]);

  // Share wiring — ported verbatim from ProfileAnalysisModal.tsx's own
  // handling (same calls, same share-to-Media/share-to-people behavior).
  // Only ever rendered for origin === "own" (see ctaArea below): viewing
  // someone else's shared analysis isn't a re-share decision, same
  // reasoning ShareCard.tsx/ChatRoom.tsx already applied by omitting
  // `shareable` when opening the old modal for this exact case.
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharingToMedia, setSharingToMedia] = useState(false);

  const handleShareToMedia = async () => {
    setSharingToMedia(true);
    try {
      const share = await createShare({ type: "analysis", analysisData: data });
      announceNewShare(share);
      setOptionsVisible(false);
      showToast(t("Shared to Media"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingToMedia(false);
    }
  };

  const handleConfirmRecipients = async (userIds: string[], groupIds: string[]) => {
    if (!user) return;
    setSending(true);
    try {
      const text = t("{{user}} is sharing their profile analysis with you.", { user: user.username });
      const caption = t("Check out my profile analyse!");
      await Promise.all([
        ...userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, { text, type: "analysis_share", analysisData: { ...data, type: "profile" } });
          await sendMessageRest(conv._id, caption);
        }),
        ...groupIds.map(async (groupId) => {
          await sendGroupRichMessage(groupId, { text, type: "analysis_share", analysisData: { ...data, type: "profile" } });
          await sendGroupMessageRest(groupId, caption);
        }),
      ]);
      await refreshConversations();
      setPickerVisible(false);
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const cardHeight = Math.min(IDEAL_CARD_HEIGHT, screenHeight * MAX_CARD_HEIGHT_RATIO);
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.base100 },
        progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: insets.top + 10 },
        progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" },
        progressFill: { height: "100%", backgroundColor: colors.primary },
        // The shared-view-only ownership header — sits to the left of the
        // close button, same row height, so it reads as this slide's own
        // chrome rather than a second header stacked above it.
        ownerRow: { position: "absolute", top: insets.top + 4, left: 16, right: 56, zIndex: 2, flexDirection: "row", alignItems: "center" },
        ownerLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        closeButton: { position: "absolute", top: insets.top + 6, right: 16, padding: 6, zIndex: 2 },
        // Direct ask: navigation between slides is a swipe gesture, not a
        // tap — each slide is its own full-screen-width page inside this
        // horizontal pagingEnabled ScrollView, not a single card
        // cross-faded in place.
        pager: { flex: 1 },
        // No flex:1 here — height is passed explicitly per page (see
        // pagerHeight above), not resolved via flex inside a horizontal
        // ScrollView's own content.
        page: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 22 },
        cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
        cardIconWrap: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
        cardTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, letterSpacing: 0.5 },
        cardScroll: { flex: 1 },
        ctaArea: { paddingHorizontal: 24, paddingBottom: insets.bottom + 20, alignItems: "center" },
        shareButton: {
          width: "100%",
          height: 54,
          borderRadius: 27,
          backgroundColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        },
        shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
      }),
    [colors, insets.top, insets.bottom]
  );

  if (cards.length === 0) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        {cards.map((card, i) => (
          <View key={card.key} style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progress[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
            />
          </View>
        ))}
      </View>
      {origin === "shared" && (
        <View style={styles.ownerRow} pointerEvents="none">
          <Text style={styles.ownerLabel} numberOfLines={1}>
            {data.nickname || t("Silent Observer")}
          </Text>
        </View>
      )}
      <Pressable style={styles.closeButton} onPress={() => router.back()} hitSlop={10} accessibilityLabel={t("Close")}>
        <Ionicons name="close" size={24} color={colors.baseContent} />
      </Pressable>

      <GHScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
        scrollEventThrottle={16}
        style={styles.pager}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
      >
        {pagerHeight > 0 &&
          cards.map((card) => (
            <View key={card.key} style={[styles.page, { width: screenWidth, height: pagerHeight }]}>
              {card.key !== "ai-summary" && (
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: `${card.accent}22` }]}>
                    <Ionicons name={card.icon} size={13} color={card.accent} />
                  </View>
                  <Text style={styles.cardTitle}>{card.title.toUpperCase()}</Text>
                </View>
              )}
              <GHScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
                <View style={{ width: cardWidth, minHeight: cardHeight }}>{card.render(revealedKeys.includes(card.key))}</View>
              </GHScrollView>
            </View>
          ))}
      </GHScrollView>

      {isLast && origin === "own" && (
        <View style={styles.ctaArea}>
          {showShareTutorial && <TutorialInfoBox text={t("Tap the share button to post this to Media.")} onDismiss={endComposeTutorial} />}
          <TutorialSpotlight active={showShareTutorial} borderRadius={27}>
            <Pressable
              style={styles.shareButton}
              onPress={() => {
                if (showShareTutorial) {
                  handleShareToMedia();
                  endComposeTutorial();
                  return;
                }
                setOptionsVisible(true);
              }}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primaryContent} />
              <Text style={styles.shareButtonText}>{t("Share")}</Text>
            </Pressable>
          </TutorialSpotlight>
        </View>
      )}

      {origin === "own" && (
        <>
          <ShareOptionsMenu
            visible={optionsVisible}
            onClose={() => setOptionsVisible(false)}
            onSendToPeople={() => {
              setOptionsVisible(false);
              setPickerVisible(true);
            }}
            onShareToMedia={handleShareToMedia}
            sharing={sharingToMedia}
          />
          <UserSharePickerModal
            visible={pickerVisible}
            title={t("Share")}
            onClose={() => setPickerVisible(false)}
            sending={sending}
            onConfirm={handleConfirmRecipients}
            allowGroups
          />
        </>
      )}
    </View>
  );
}
