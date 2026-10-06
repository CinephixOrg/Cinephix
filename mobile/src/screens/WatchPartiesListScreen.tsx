import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Share, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useCommunity } from "../hooks/useCommunities";
import { listWatchParties, toggleWatchPartyRsvp, watchPartyHighlightCardUrl } from "../api/groupService";
import WatchPartyCard from "../components/socials/WatchPartyCard";
import { isWatchPartyLive } from "../utils/watchParty";
import type { GroupWatchParty } from "../types";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";

// "See all" behind Overview's own 3-card cap — every watch party this
// community has, split the same way the backend already does (upcoming /
// past), with live ones (there can be more than one at once) pulled out
// of past and led with, same priority Overview's own cards use.
export default function WatchPartiesListScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { group } = useCommunity(slug ?? "");
  const accent = group?.accentColor || colors.primary;
  const isOwner = !!user && group?.owner?._id === user._id;

  const [parties, setParties] = useState<{ upcoming: GroupWatchParty[]; past: GroupWatchParty[] } | undefined>(undefined);
  const [rsvping, setRsvping] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!slug) return;
    listWatchParties(slug)
      .then(setParties)
      .catch(() => setParties((current) => current ?? { upcoming: [], past: [] }));
  }, [slug]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("Watch Parties") });
  }, [navigation, t]);

  const rsvp = useCallback(
    async (party: GroupWatchParty) => {
      if (!slug || rsvping) return;
      setRsvping(party._id);
      try {
        const result = await toggleWatchPartyRsvp(slug, party._id);
        setParties((current) =>
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
    [slug, rsvping, showToast, t]
  );

  const shareHighlight = useCallback(
    async (party: GroupWatchParty) => {
      if (!slug || !group) return;
      const url = watchPartyHighlightCardUrl(slug, party._id);
      try {
        await Share.share({ message: t("{{name}}'s watch party recap on Cinephix! {{url}}", { name: group.name, url }), url });
      } catch {}
    },
    [slug, group, t]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        content: { padding: 16, gap: 22, paddingBottom: 40 },
        sectionTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.baseContent, marginBottom: 10 },
        cards: { gap: 10 },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, paddingHorizontal: 32 },
        pastRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.base200, borderRadius: 14, padding: 10 },
        pastPoster: { width: 36, height: 54, borderRadius: 6, backgroundColor: colors.base300 },
        pastInfo: { flex: 1, minWidth: 0 },
        pastTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.baseContent },
        pastMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.placeholder, marginTop: 2 },
        shareIconButton: { padding: 4 },
      }),
    [colors]
  );

  if (!parties) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const liveParties = parties.past.filter(isWatchPartyLive);
  const liveIds = new Set(liveParties.map((p) => p._id));
  const pastOnly = parties.past.filter((p) => !liveIds.has(p._id));
  const isEmpty = liveParties.length === 0 && parties.upcoming.length === 0 && pastOnly.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        {isEmpty ? (
          <Text style={styles.empty}>{t("No watch parties yet.")}</Text>
        ) : (
          <>
            {liveParties.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>{t("Live now")}</Text>
                <View style={styles.cards}>
                  {liveParties.map((party) => (
                    <WatchPartyCard
                      key={party._id}
                      party={party}
                      live
                      accent={accent}
                      onPress={() => router.push(`/socials/communities/${slug}/watch-party/${party._id}` as never)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {parties.upcoming.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>{t("Upcoming")}</Text>
                <View style={styles.cards}>
                  {parties.upcoming.map((party) => (
                    <WatchPartyCard
                      key={party._id}
                      party={party}
                      live={false}
                      accent={accent}
                      onPress={() => router.push(`/socials/communities/${slug}/watch-party/${party._id}` as never)}
                      onRsvp={() => rsvp(party)}
                      rsvping={rsvping === party._id}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {pastOnly.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>{t("Past")}</Text>
                <View style={styles.cards}>
                  {pastOnly.map((party) => (
                    <Pressable key={party._id} style={styles.pastRow} onPress={() => router.push(`/socials/communities/${slug}/watch-party/${party._id}` as never)}>
                      {party.contentPosterUrl ? <Image source={{ uri: `${POSTER_BASE}${party.contentPosterUrl}` }} style={styles.pastPoster} /> : null}
                      <View style={styles.pastInfo}>
                        <Text style={styles.pastTitle} numberOfLines={1}>
                          {party.contentTitle}
                        </Text>
                        <Text style={styles.pastMeta}>
                          {new Date(party.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {t("{{count}} attended", { count: party.attendeeCount ?? 0 })}
                        </Text>
                      </View>
                      {isOwner ? (
                        <Pressable style={styles.shareIconButton} onPress={() => shareHighlight(party)} hitSlop={8}>
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
        )}
      </View>
    </View>
  );
}
