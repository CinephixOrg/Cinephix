import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import TierAvatarFrame from "../TierAvatarFrame";
import { markVars, sentenceFor, splitEmphasis, starString } from "../../utils/personalActivity";
import type { PersonalActivityItem, PersonalActivityType } from "../../types";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const THUMB = 44;

type IconName = keyof typeof Ionicons.glyphMap;
type Colors = { base100: string; base200: string; base300: string; baseContent: string; placeholder: string; border: string; primary: string };

// Each type's glyph and hue. The hues are fixed (not theme colours) so a
// type reads the same in every theme, and are only ever used on a faint
// tint of themselves — never for body text.
const TYPE_META: Record<PersonalActivityType, { icon: IconName; color: string }> = {
  rated: { icon: "star", color: "#F5B301" },
  reviewed: { icon: "create", color: "#60A5FA" },
  review_liked: { icon: "heart", color: "#F472B6" },
  list_liked: { icon: "heart-circle", color: "#F472B6" },
  followed: { icon: "person-add", color: "#34D399" },
  list_created: { icon: "albums", color: "#A78BFA" },
  watchlist_added: { icon: "checkmark-done", color: "#22D3EE" },
  towatch_added: { icon: "bookmark", color: "#22D3EE" },
  favorited: { icon: "heart", color: "#F87171" },
  group_joined: { icon: "people", color: "#FB923C" },
  shared: { icon: "share-social", color: "#60A5FA" },
  match_analyzed: { icon: "pulse", color: "#A78BFA" },
  profile_analyzed: { icon: "pie-chart", color: "#A78BFA" },
};

export function createActivityRowStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 16 },
    rowPressed: { backgroundColor: colors.base200 },
    badge: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, minWidth: 0 },
    sentence: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20, color: colors.baseContent },
    strong: { fontFamily: fonts.bold, color: colors.baseContent },
    stars: { fontFamily: fonts.bold, fontSize: 14, color: "#F5B301", letterSpacing: 0.5 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    time: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
    score: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    scoreText: { fontFamily: fonts.bold, fontSize: 11.5 },
    excerpt: {
      fontSize: 13,
      lineHeight: 18.5,
      color: colors.placeholder,
      fontStyle: "italic",
      marginTop: 6,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
    },
    poster: { width: THUMB * (2 / 3) + 4, height: THUMB + 10, borderRadius: 7, backgroundColor: colors.base300 },
    cover: { width: THUMB, height: THUMB, borderRadius: 12, backgroundColor: colors.base300 },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.base300 },
    avatarFallbackText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  });
}

export type ActivityRowStyles = ReturnType<typeof createActivityRowStyles>;

function scoreColor(score: number) {
  return score >= 70 ? "#34D399" : score >= 45 ? "#F5B301" : "#F87171";
}

interface Props {
  item: PersonalActivityItem;
  styles: ActivityRowStyles;
  onPress?: (item: PersonalActivityItem) => void;
}

// One line of your own activity: what kind it is (the tinted badge), one
// sentence saying what you did with the names in bold, when, and what it
// was about on the right (a poster, a person, a community). No avatar or
// username — on your own page every row would be the same one.
function PersonalActivityRow({ item, styles, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const meta = TYPE_META[item.type] ?? TYPE_META.shared;
  const sentence = sentenceFor(item, t("Media"));
  const runs = splitEmphasis(t(sentence.key, markVars(sentence.vars)));
  const stars = item.type === "rated" ? starString(item.value) : "";
  const time = new Date(item.createdAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const person = item.targetUser && (item.type === "followed" || item.type === "match_analyzed") ? item.targetUser : null;

  let thumb = null;
  if (item.content) {
    thumb = item.content.poster_path ? (
      <Image source={{ uri: `${POSTER_BASE}${item.content.poster_path}` }} style={styles.poster} />
    ) : (
      <View style={styles.poster} />
    );
  } else if (person) {
    thumb = (
      <TierAvatarFrame tier={person.accountTier} size={THUMB}>
        {(inner) =>
          person.profile_pic_url ? (
            <Image source={{ uri: person.profile_pic_url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
          ) : (
            <View style={[styles.avatarFallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
              <Text style={styles.avatarFallbackText}>{person.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )
        }
      </TierAvatarFrame>
    );
  } else if (item.type === "group_joined" && item.groupCoverImage) {
    thumb = <Image source={{ uri: item.groupCoverImage }} style={styles.cover} />;
  }

  const plainText = runs.map((run) => run.text).join("");

  return (
    <Pressable
      onPress={onPress ? () => onPress(item) : undefined}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${plainText}${stars ? `, ${stars}` : ""}, ${time}`}
    >
      <View style={[styles.badge, { backgroundColor: `${meta.color}24` }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sentence} numberOfLines={3}>
          {runs.map((run, i) =>
            run.strong ? (
              <Text key={i} style={styles.strong}>
                {run.text}
              </Text>
            ) : (
              run.text
            )
          )}
          {stars ? <Text style={styles.stars}>{`  ${stars}`}</Text> : null}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{time}</Text>
          {item.type === "match_analyzed" && typeof item.score === "number" ? (
            <View style={[styles.score, { backgroundColor: `${scoreColor(item.score)}22` }]}>
              <Text style={[styles.scoreText, { color: scoreColor(item.score) }]}>
                {t("{{percent}}% match", { percent: item.score })}
              </Text>
            </View>
          ) : null}
        </View>
        {item.type === "reviewed" && item.excerpt ? (
          <Text style={styles.excerpt} numberOfLines={2}>
            {item.excerpt}
          </Text>
        ) : null}
      </View>

      {thumb}
    </Pressable>
  );
}

export default memo(PersonalActivityRow);
