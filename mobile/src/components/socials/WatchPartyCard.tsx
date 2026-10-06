import { memo, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import LiveBadge from "../common/LiveBadge";
import RotatingAvatarStack from "../common/RotatingAvatarStack";
import { localeUpper } from "../../utils/text";
import type { GroupWatchParty } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";

type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors, accent: string) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.base200,
      borderRadius: 16,
      padding: 12,
      borderWidth: 2,
      borderColor: "transparent",
    },
    cardLive: { borderColor: accent },
    poster: { width: 48, height: 72, borderRadius: 7, backgroundColor: colors.base300 },
    info: { flex: 1, minWidth: 0, gap: 2 },
    liveBadgeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent },
    liveLabel: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.8, color: accent },
    title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.baseContent },
    meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
    attendeesRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    rsvpPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: accent },
    rsvpPillJoin: { backgroundColor: "transparent" },
    rsvpPillJoined: { backgroundColor: colors.base300, borderColor: colors.border },
    rsvpPillText: { fontFamily: fonts.bold, fontSize: 11.5 },
  });
}

interface Props {
  party: GroupWatchParty;
  live: boolean;
  accent: string;
  onPress: () => void;
  onRsvp?: () => void;
  rsvping?: boolean;
}

// One card, shared by Overview's own max-3 rail and the full Watch
// Parties list page — a live one gets the accent border + pulsing badge +
// rotating "who's in it" avatars (no inline RSVP, same as before: tapping
// it opens the room, where RSVP already lives in its header); an upcoming
// one gets the plain treatment + an inline RSVP pill, same as the old
// per-row list did.
function WatchPartyCard({ party, live, accent, onPress, onRsvp, rsvping }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

  return (
    <Pressable style={[styles.card, live && styles.cardLive]} onPress={onPress}>
      {party.contentPosterUrl ? <Image source={{ uri: `${POSTER_BASE}${party.contentPosterUrl}` }} style={styles.poster} /> : null}
      <View style={styles.info}>
        {live ? <LiveBadge label={localeUpper(t("Live now"))} dotStyle={styles.liveDot} textStyle={styles.liveLabel} containerStyle={styles.liveBadgeRow} /> : null}
        <Text style={styles.title} numberOfLines={1}>
          {party.contentTitle}
        </Text>
        {live ? (
          // "going" stops meaning anything once it's actually started —
          // direct report ("0 attended ... going görünüyor") — this is
          // attendeeCount now (who's actually posted), never rsvpCount.
          party.rsvpUsers && party.rsvpUsers.length > 0 ? (
            <View style={styles.attendeesRow}>
              <RotatingAvatarStack users={party.rsvpUsers} size={18} max={5} />
              <Text style={styles.meta}>{t("{{count}} attended", { count: party.attendeeCount ?? 0 })}</Text>
            </View>
          ) : (
            <Text style={styles.meta}>{t("{{count}} attended", { count: party.attendeeCount ?? 0 })}</Text>
          )
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            {new Date(party.scheduledAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {" · "}
            {t("{{count}} going", { count: party.rsvpCount })}
          </Text>
        )}
      </View>
      {!live && onRsvp ? (
        <Pressable style={[styles.rsvpPill, party.isRsvped ? styles.rsvpPillJoined : styles.rsvpPillJoin]} onPress={onRsvp} disabled={rsvping}>
          <Text style={[styles.rsvpPillText, { color: party.isRsvped ? colors.baseContent : accent }]}>{party.isRsvped ? t("Going") : t("RSVP")}</Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
      )}
    </Pressable>
  );
}

export default memo(WatchPartyCard);
