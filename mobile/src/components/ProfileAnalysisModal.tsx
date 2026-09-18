import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, type LayoutChangeEvent } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import UserSharePickerModal from "./UserSharePickerModal";
import ShareOptionsMenu from "./ShareOptionsMenu";
import ProfileAnalysisCardDeck, {
  createAnalysisDeckState,
  type AnalysisDeckState,
} from "./profile/ProfileAnalysisCardDeck";
import { getOrCreateConversation, sendMessageRest, sendRichMessage } from "../api/conversationService";
import { sendGroupMessageRest, sendGroupRichMessage } from "../api/groupService";
import { createShare } from "../api/shareService";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useRecentShares } from "../context/RecentSharesContext";
import { useToast } from "../context/ToastContext";
import type { ProfileAnalysis, ProfileAnalysisItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ProfileAnalysis | null;
  // Present only when this is a *fresh* result the viewer just generated on
  // their own Profile screen — omitted when viewing a previously-shared one
  // in ChatRoom.tsx, matching AnalyzeModal.tsx's identical reasoning: no
  // re-sharing something that was already shared with you.
  shareable?: boolean;
  // Set only where the caller hides this modal while the viewer is away on
  // another screen — i.e. it gates `visible` on its own screen focus, the
  // way ProfileCategoryTabs does. Without that, tapping a poster would push
  // the title's page UNDERNEATH this Modal (its own native window, above the
  // whole nav stack) and strand the viewer looking at an analysis they can't
  // dismiss their way out of. Off by default, so posters simply aren't
  // tappable anywhere that hasn't opted in.
  navigable?: boolean;
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    // Tighter padding + a taller ceiling than the original sheet: the
    // persona card's closing "Did You Know?" box was landing past the fold
    // and needing a scroll to reach.
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 12 },
    // No more solid-color header banner — the CineMatch-style deck below
    // carries its own eyebrow + gradient nickname as card 1, so this sheet
    // is just a neutral frame around it instead of duplicating that chrome.
    sheet: { backgroundColor: colors.base100, borderRadius: 20, overflow: "hidden", maxHeight: "94%" },
    deckWrap: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 4 },
    loadingWrap: { paddingHorizontal: 20, paddingVertical: 40, alignItems: "center" },
    loadingText: { color: colors.baseContent, fontSize: 14 },
    // Icon-only, mirroring the circular action buttons ProfilePhotoViewerModal
    // already established (52x52, centered glyph) rather than the old
    // text-labeled "Share"/"Close" pair — no label under these two, per
    // direct ask, so accessibilityLabel carries what the icon alone can't.
    buttonRow: { flexDirection: "row", justifyContent: "center", gap: 20, paddingVertical: 12 },
    iconButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButton: { backgroundColor: colors.base300 },
    shareButton: { backgroundColor: colors.primary },
  });
}

export default function ProfileAnalysisModal({ visible, onClose, data, shareable, navigable }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { announce: announceNewShare } = useRecentShares();
  const { showToast } = useToast();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharingToMedia, setSharingToMedia] = useState(false);
  const [deckWidth, setDeckWidth] = useState(0);

  const handleShareToMedia = async () => {
    if (!data) return;
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
    if (!data || !user) return;
    setSending(true);
    try {
      const text = t("{{user}} is sharing their profile analysis with you.", { user: user.username });
      // Same "card first, then a separate plain-text caption message"
      // pattern as the Sync share (AnalyzeModal.tsx/MatchCoverCard.tsx),
      // direct ask to keep the two designs consistent end to end, not just
      // the card itself.
      const caption = t("Check out my profile analyse!");
      await Promise.all([
        ...userIds.map(async (userId) => {
          const conv = await getOrCreateConversation(userId);
          await sendRichMessage(conv._id, {
            text,
            type: "analysis_share",
            analysisData: { ...data, type: "profile" },
          });
          await sendMessageRest(conv._id, caption);
        }),
        ...groupIds.map(async (groupId) => {
          await sendGroupRichMessage(groupId, {
            text,
            type: "analysis_share",
            analysisData: { ...data, type: "profile" },
          });
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

  const handleDeckLayout = (e: LayoutChangeEvent) => setDeckWidth(e.nativeEvent.layout.width);

  // Closes first, then navigates: this Modal is its own native window sitting
  // above the whole nav stack, so pushing a screen underneath it would just
  // leave the user staring at the still-open analysis.
  const handleUpgrade = useCallback(() => {
    onClose();
    router.push("/profile/settings");
  }, [onClose, router]);

  // The deck's own scroll position, focused genre and already-played
  // animations, parked somewhere that survives the round trip to a title's
  // page. It has to live out here rather than inside the deck: an RN Modal
  // unmounts its children while hidden, so the deck itself is destroyed and
  // rebuilt, but this component stays mounted the whole time.
  const deckStateRef = useRef<AnalysisDeckState>(createAnalysisDeckState());

  // Deliberately does NOT call onClose. The caller keeps this modal "open" in
  // its own state and merely hides it while its screen is unfocused, so
  // pressing back on the title's page brings the analysis straight back,
  // exactly where it was.
  //
  // useCallback matters here beyond habit: this identity is what the
  // memoized card bodies and poster rows compare against, so an inline
  // arrow would re-render every card on every deck render.
  const handleOpenItem = useCallback(
    (item: ProfileAnalysisItem) => {
      router.push(`/profile/content/${item.type}/${item._id}` as never);
    },
    [router]
  );
  const openItem = navigable ? handleOpenItem : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* RN's Modal renders into its own detached native window, outside the
          app-root GestureHandlerRootView (app/_layout.tsx) — without a second
          one here, react-native-gesture-handler recognizes nothing inside,
          and the deck's horizontal poster rows (which use gesture-handler's
          ScrollView so they win the pan against the outer card pager) would
          simply not scroll. */}
      <GestureHandlerRootView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.deckWrap} onLayout={handleDeckLayout}>
            {data && deckWidth > 0 ? (
              <ProfileAnalysisCardDeck
                data={data}
                containerWidth={deckWidth}
                viewerTier={user?.accountTier}
                onUpgrade={handleUpgrade}
                onOpenItem={openItem}
                stateRef={deckStateRef}
              />
            ) : (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>{t("Aggregating statistics...")}</Text>
              </View>
            )}
          </View>

          <View style={styles.buttonRow}>
            {shareable && data && (
              <Pressable
                style={[styles.iconButton, styles.shareButton]}
                onPress={() => setOptionsVisible(true)}
                accessibilityLabel={t("Share")}
              >
                <Ionicons name="share-social-outline" size={22} color={colors.primaryContent} />
              </Pressable>
            )}
            <Pressable style={[styles.iconButton, styles.closeButton]} onPress={onClose} accessibilityLabel={t("Close")}>
              <Ionicons name="close" size={24} color={colors.baseContent} />
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>

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
    </Modal>
  );
}
