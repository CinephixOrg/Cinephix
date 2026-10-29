import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { getWatchParty, getWatchPartyMessages, sendWatchPartyMessageRest, toggleWatchPartyRsvp } from "../api/groupService";
import ChatRoom from "../components/ChatRoom";
import type { GroupWatchParty } from "../types";
import { fonts } from "../theme/typography";
import { isWatchPartyLive } from "../utils/watchParty";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const WAITING_POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// A watch party's own companion chat room — the full-page version of what
// CommunityHubTab.tsx's watch-party rows already summarize. Opens from
// there; the header repeats the title/time/RSVP so the chat itself doesn't
// need its own separate header row.
export default function WatchPartyRoomScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const { joinRoom, leaveRoom } = useChat();
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();

  const [party, setParty] = useState<GroupWatchParty | null>(null);
  const [rsvping, setRsvping] = useState(false);

  const load = useCallback(() => {
    if (!slug || !id) return;
    getWatchParty(slug, id)
      .then(setParty)
      .catch(() => {});
  }, [slug, id]);

  useEffect(load, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: party?.contentTitle ?? t("Watch Party") });
  }, [navigation, party?.contentTitle, t]);

  useEffect(() => {
    if (!id) return;
    joinRoom("watchparty", id);
    return () => leaveRoom("watchparty", id);
  }, [id, joinRoom, leaveRoom]);

  const rsvp = useCallback(async () => {
    if (!slug || !id || rsvping) return;
    setRsvping(true);
    try {
      const result = await toggleWatchPartyRsvp(slug, id);
      setParty((current) => (current ? { ...current, isRsvped: result.isRsvped, rsvpCount: result.rsvpCount } : current));
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setRsvping(false);
    }
  }, [slug, id, rsvping, showToast, t]);

  const started = party ? new Date(party.scheduledAt).getTime() <= Date.now() : false;
  // TC-112: started alone never turns back off once durationMinutes has
  // elapsed — the composer stayed open forever after a party ended. The
  // message history itself still needs to stay visible/scrollable, so
  // this doesn't hide the room (canChat) — just the composer
  // (ChatRoom's own composeDisabledReason).
  const live = party ? isWatchPartyLive(party) : false;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        poster: { width: 36, height: 54, borderRadius: 6, backgroundColor: colors.base300 },
        headerInfo: { flex: 1, minWidth: 0 },
        headerTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
        headerMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder, marginTop: 2 },
        rsvpButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
        },
        rsvpJoined: { backgroundColor: colors.base200, borderWidth: 1, borderColor: colors.border },
        rsvpJoin: { backgroundColor: colors.primary },
        rsvpText: { fontFamily: fonts.bold, fontSize: 12.5 },

        // The pre-show state — direct ask: "açılan watch party chat
        // ekranının tam ortasına optimal boyutta posteri soluk koy." No
        // chat at all before it's actually started, just this.
        waitingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
        waitingPoster: { width: 150, height: 225, borderRadius: 14, backgroundColor: colors.base200, opacity: 0.4 },
        waitingTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.baseContent, textAlign: "center" },
        waitingMeta: { fontFamily: fonts.medium, fontSize: 14, color: colors.placeholder, textAlign: "center" },
        waitingRsvpButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 14,
          marginTop: 4,
        },
        composerDisabled: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.base100,
        },
        composerDisabledBox: {
          flex: 1,
          minHeight: 42,
          borderRadius: 21,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          paddingHorizontal: 16,
          justifyContent: "center",
        },
        composerDisabledText: { fontFamily: fonts.medium, fontSize: 14, color: colors.placeholder },
        composerDisabledSend: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
        },
      }),
    [colors]
  );

  if (party && !started) {
    return (
      <View style={styles.screen}>
        <View style={styles.waitingWrap}>
          {party.contentPosterUrl ? <Image source={{ uri: `${WAITING_POSTER_BASE}${party.contentPosterUrl}` }} style={styles.waitingPoster} /> : null}
          <Text style={styles.waitingTitle}>{party.contentTitle}</Text>
          <Text style={styles.waitingMeta}>
            {new Date(party.scheduledAt).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            {"\n"}
            {t("{{count}} going", { count: party.rsvpCount })}
          </Text>
          <Pressable style={[styles.waitingRsvpButton, party.isRsvped ? styles.rsvpJoined : styles.rsvpJoin]} onPress={rsvp} disabled={rsvping}>
            <Ionicons name={party.isRsvped ? "checkmark" : "add"} size={16} color={party.isRsvped ? colors.baseContent : colors.primaryContent} />
            <Text style={[styles.rsvpText, { color: party.isRsvped ? colors.baseContent : colors.primaryContent }]}>
              {party.isRsvped ? t("Going") : t("RSVP")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.composerDisabled}>
          <View style={styles.composerDisabledBox}>
            <Text style={styles.composerDisabledText} numberOfLines={1}>
              {t("This watch party hasn't started yet")}
            </Text>
          </View>
          <View style={styles.composerDisabledSend}>
            <Ionicons name="send" size={18} color={colors.placeholder} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {party ? (
        <View style={styles.header}>
          {party.contentPosterUrl ? <Image source={{ uri: `${POSTER_BASE}${party.contentPosterUrl}` }} style={styles.poster} /> : null}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {party.contentTitle}
            </Text>
            {/* "Going" stops meaning anything once it's actually
                started — direct report — so once started this is just
                the real attendee count, and the RSVP button (below) is
                gone entirely rather than disabled: there's nothing left
                to RSVP to. */}
            <Text style={styles.headerMeta}>{t("{{count}} attended", { count: party.attendeeCount ?? 0 })}</Text>
          </View>
        </View>
      ) : null}

      {slug && id ? (
        <ChatRoom
          key={id}
          roomType="watchparty"
          roomId={id}
          canChat
          composeDisabledReason={live ? undefined : t("This watch party has ended")}
          emptyText={t("No messages yet. Start the conversation!")}
          fetchMessages={(before, limit) => getWatchPartyMessages(slug, id, before, limit)}
          markRead={async () => {}}
          sendRest={(text) => sendWatchPartyMessageRest(slug, id, text)}
        />
      ) : null}
    </View>
  );
}
