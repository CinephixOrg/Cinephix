import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { fonts } from "../../theme/typography";
import ConfirmDialog from "../settings/ConfirmDialog";
import { isEpisodeWatched } from "../../utils/episodeProgress";
import {
  getEpisodeTracking,
  getSeasonEpisodes,
  setAllEpisodesWatched,
  setEpisodesWatched,
  type EpisodeInfo,
  type EpisodeTracking,
} from "../../api/episodeService";

interface Props {
  seriesId: string;
  /** Changed by the detail page when it marked every episode itself (its "watched it all?" question). */
  refreshKey: number;
  /** After "All episodes watched" is marked here — the page puts the series on the Watched list. */
  onAllWatched: () => void;
}

const episodeKey = (s: number, e: number) => `${s}:${e}`;
const seasonKey = (s: number) => `${s}:*`;

// A series' seasons on its detail page (TC-141): each season a row that
// opens to its episodes, a check to mark an episode or a whole season
// watched, and "All episodes watched" for a series watched in the past.
// Episode names and dates come from TMDB through the backend, only for the
// seasons opened. A tap shows its result at once (`pending`) and settles
// when the server answers.
export default function SeasonsSection({ seriesId, refreshKey, onAllWatched }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [tracking, setTracking] = useState<EpisodeTracking | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [episodes, setEpisodes] = useState<Record<number, EpisodeInfo[] | "loading" | "error">>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [confirmUnmarkAll, setConfirmUnmarkAll] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        // The detail page's own section title.
        sectionTitle: { fontSize: 18, fontFamily: fonts.bold, marginTop: 16, marginBottom: 4, color: colors.baseContent },
        headerCount: { marginTop: 12, fontSize: 13, fontFamily: fonts.medium, color: colors.placeholder },
        // The page's action-row toggle (toggleButton / toggleButtonActive).
        allButton: {
          flexDirection: "row",
          gap: 6,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 6,
          marginBottom: 8,
        },
        allButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        allButtonText: { fontFamily: fonts.medium, color: colors.baseContent },
        allButtonTextActive: { color: colors.primaryContent },
        // The page's friendsBox.
        box: { backgroundColor: colors.base200, borderRadius: 12, overflow: "hidden" },
        seasonRow: { flexDirection: "row", alignItems: "center", minHeight: 56 },
        rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        seasonMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingLeft: 14 },
        seasonText: { flex: 1, gap: 2 },
        seasonTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        meta: { fontSize: 12, color: colors.placeholder },
        check: { width: 52, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
        episodes: { backgroundColor: colors.base100, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        episodeRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
        episodeMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingLeft: 16 },
        episodeNumber: { width: 22, fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, textAlign: "right" },
        episodeText: { flex: 1, gap: 1 },
        episodeName: { fontSize: 14, color: colors.baseContent },
        notAired: { opacity: 0.5 },
        centered: { paddingVertical: 14, alignItems: "center", gap: 6 },
        message: { color: colors.placeholder, textAlign: "center" },
        retry: { color: colors.primary, fontFamily: fonts.medium },
      }),
    [colors]
  );

  const load = useCallback(() => {
    setFailed(false);
    getEpisodeTracking(seriesId)
      .then(setTracking)
      .catch(() => setFailed(true));
  }, [seriesId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const loadSeason = useCallback(
    (season: number) => {
      setEpisodes((prev) => ({ ...prev, [season]: "loading" }));
      getSeasonEpisodes(seriesId, season)
        .then((list) => setEpisodes((prev) => ({ ...prev, [season]: list })))
        .catch(() => setEpisodes((prev) => ({ ...prev, [season]: "error" })));
    },
    [seriesId]
  );

  const toggleOpen = (season: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });
    const loaded = episodes[season];
    if (!loaded || loaded === "error") loadSeason(season);
  };

  // Shows `watched` for `key` at once, then the server's answer.
  const change = async (key: string, watched: boolean, request: () => Promise<EpisodeTracking>) => {
    setPending((prev) => ({ ...prev, [key]: watched }));
    try {
      setTracking(await request());
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setPending((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const markAll = async (watched: boolean) => {
    await change("all", watched, () => setAllEpisodesWatched(seriesId, watched));
    if (watched) onAllWatched();
  };

  if (tracking === null) return null; // TMDB doesn't know this series
  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" }) : null;

  const summary = tracking?.summary;
  const allWatched = pending.all ?? (summary ? summary.aired > 0 && summary.watched === summary.aired : false);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t("Seasons")}</Text>
        {summary && summary.aired > 0 ? (
          <Text style={styles.headerCount}>{t("{{watched}}/{{total}} episodes", { watched: summary.watched, total: summary.aired })}</Text>
        ) : null}
      </View>

      {tracking === undefined ? (
        <View style={styles.centered}>
          {failed ? (
            <>
              <Text style={styles.message}>{t("Episodes couldn't be loaded.")}</Text>
              <Pressable onPress={load} hitSlop={8}>
                <Text style={styles.retry}>{t("Try again")}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      ) : (
        <>
          {tracking.lastAired ? (
            <Pressable
              style={[styles.allButton, allWatched && styles.allButtonActive]}
              onPress={() => (allWatched ? setConfirmUnmarkAll(true) : markAll(true))}
              disabled={pending.all !== undefined}
            >
              <Ionicons name="checkmark-done" size={18} color={allWatched ? colors.primaryContent : colors.baseContent} />
              <Text style={[styles.allButtonText, allWatched && styles.allButtonTextActive]}>
                {allWatched ? t("All episodes watched") : t("Mark all episodes as watched")}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.box}>
            {tracking.seasons.map((season, index) => {
              const s = season.season_number;
              const counts = summary?.perSeason[s];
              const aired = counts?.aired ?? 0;
              const complete = pending[seasonKey(s)] ?? (aired > 0 && counts!.watched === aired);
              const started = (counts?.watched ?? 0) > 0;
              const isOpen = open.has(s);
              const list = episodes[s];
              const year = season.air_date?.slice(0, 4);
              const meta =
                s === 0
                  ? t("{{count}} episodes", { count: season.episode_count })
                  : aired === 0
                    ? t("Not aired yet")
                    : [t("{{watched}}/{{total}} episodes", { watched: counts!.watched, total: aired }), year].filter(Boolean).join(" · ");
              return (
                <View key={s} style={index > 0 && styles.rowDivider}>
                  <View style={styles.seasonRow}>
                    <Pressable style={styles.seasonMain} onPress={() => toggleOpen(s)}>
                      <View style={styles.seasonText}>
                        <Text style={styles.seasonTitle}>{s === 0 ? t("Specials") : t("Season {{number}}", { number: s })}</Text>
                        <Text style={styles.meta}>{meta}</Text>
                      </View>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.placeholder} />
                    </Pressable>
                    {/* Specials have no season-wide mark: they aren't counted
                        as the series (backend/utils/episodeProgress.js). */}
                    {s > 0 && aired > 0 ? (
                      <Pressable
                        style={styles.check}
                        onPress={() => change(seasonKey(s), !complete, () => setEpisodesWatched(seriesId, s, undefined, !complete))}
                        disabled={pending[seasonKey(s)] !== undefined}
                        hitSlop={4}
                      >
                        <Ionicons
                          name={complete ? "checkmark-circle" : started ? "checkmark-circle-outline" : "ellipse-outline"}
                          size={26}
                          color={complete || started ? colors.primary : colors.placeholder}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.check} />
                    )}
                  </View>

                  {isOpen ? (
                    <View style={styles.episodes}>
                      {list === undefined || list === "loading" ? (
                        <View style={styles.centered}>
                          <ActivityIndicator color={colors.primary} />
                        </View>
                      ) : list === "error" ? (
                        <View style={styles.centered}>
                          <Text style={styles.message}>{t("Episodes couldn't be loaded.")}</Text>
                          <Pressable onPress={() => loadSeason(s)} hitSlop={8}>
                            <Text style={styles.retry}>{t("Try again")}</Text>
                          </Pressable>
                        </View>
                      ) : (
                        list.map((ep, i) => {
                          const key = episodeKey(s, ep.episode_number);
                          // A season or "all" mark in flight: marking takes
                          // only aired episodes (and "all" no specials),
                          // unmarking takes everything — as the server will.
                          const covers = (mark: boolean | undefined, specials: boolean) =>
                            mark !== undefined && (!mark || (ep.aired && (specials || s > 0)));
                          const watched =
                            pending[key] ??
                            (covers(pending.all, false)
                              ? pending.all!
                              : covers(pending[seasonKey(s)], true)
                                ? pending[seasonKey(s)]!
                                : isEpisodeWatched(tracking.progress, s, ep.episode_number));
                          const details = ep.aired
                            ? [formatDate(ep.air_date), ep.runtime ? t("{{count}} min", { count: ep.runtime }) : null].filter(Boolean).join(" · ")
                            : [t("Not aired yet"), formatDate(ep.air_date)].filter(Boolean).join(" · ");
                          return (
                            <View key={ep.episode_number} style={[styles.episodeRow, i > 0 && styles.rowDivider, !ep.aired && styles.notAired]}>
                              <View style={styles.episodeMain}>
                                <Text style={styles.episodeNumber}>{ep.episode_number}</Text>
                                <View style={styles.episodeText}>
                                  <Text style={styles.episodeName} numberOfLines={1}>
                                    {ep.name || t("Episode {{number}}", { number: ep.episode_number })}
                                  </Text>
                                  {details ? <Text style={styles.meta}>{details}</Text> : null}
                                </View>
                              </View>
                              {ep.aired || watched ? (
                                <Pressable
                                  style={styles.check}
                                  onPress={() => change(key, !watched, () => setEpisodesWatched(seriesId, s, ep.episode_number, !watched))}
                                  disabled={pending[key] !== undefined}
                                  hitSlop={4}
                                >
                                  <Ionicons
                                    name={watched ? "checkmark-circle" : "ellipse-outline"}
                                    size={24}
                                    color={watched ? colors.primary : colors.placeholder}
                                  />
                                </Pressable>
                              ) : (
                                <View style={styles.check} />
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      )}

      <ConfirmDialog
        visible={confirmUnmarkAll}
        icon="refresh-outline"
        title={t("Unmark all episodes?")}
        message={t("Every episode you've marked for this series is cleared, along with when you watched it.")}
        confirmLabel={t("Unmark")}
        cancelLabel={t("Cancel")}
        danger
        onConfirm={() => {
          setConfirmUnmarkAll(false);
          markAll(false);
        }}
        onCancel={() => setConfirmUnmarkAll(false)}
      />
    </View>
  );
}
