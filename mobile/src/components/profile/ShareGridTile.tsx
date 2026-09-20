import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { typeMeta } from "../ShareCard";
import type { Share } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

interface Props {
  share: Share;
  size: number;
  onPress: () => void;
  style?: any;
}

// Square grid thumbnail for Profile's "Your Sharings" tab — no avatar/
// username (redundant, this is always the owner's own profile), just a
// type-appropriate preview: Recommendation shows the cropped poster,
// Review/Analysis (no poster since the ShareCard redesign) show a
// synthesized text preview on the app's existing neutral card surface.
// Every tile gets a small type-icon badge (same icon/color ShareCard's own
// header chip uses) so type is still identifiable without the full card.
export default function ShareGridTile({ share, size, onPress, style }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const meta = typeMeta(share.type, colors, t);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tile: { width: size, height: size, borderRadius: 8, overflow: "hidden", backgroundColor: colors.base300 },
        badge: {
          position: "absolute",
          top: 6,
          right: 6,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        },
        textTile: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8 },
        analysisNickname: { fontFamily: fonts.bold, fontSize: 11, color: colors.baseContent, marginBottom: 3, textAlign: "center" },
        analysisSummary: { fontSize: 10, color: colors.placeholder, lineHeight: 13, textAlign: "center" },
        reviewQuote: { fontFamily: fonts.italic, fontSize: 10, color: colors.baseContent, lineHeight: 13, textAlign: "center" },
      }),
    [size, colors]
  );

  const posterUri = share.contentData?.posterUrl ? `${POSTER_BASE}${share.contentData.posterUrl}` : null;

  let body: React.ReactNode;
  switch (share.type) {
    case "recommendation":
      body = posterUri ? (
        <Image source={{ uri: posterUri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <View style={styles.textTile}>
          <Ionicons name="film-outline" size={22} color={colors.placeholder} />
        </View>
      );
      break;
    case "analysis":
      body = (
        <View style={styles.textTile}>
          {share.analysisData?.nickname ? (
            <Text style={styles.analysisNickname} numberOfLines={1}>
              {share.analysisData.nickname}
            </Text>
          ) : null}
          {share.analysisData?.personalitySummary ? (
            <Text style={styles.analysisSummary} numberOfLines={4}>
              {share.analysisData.personalitySummary}
            </Text>
          ) : null}
        </View>
      );
      break;
    case "list":
      body = (
        <View style={styles.textTile}>
          <Text style={styles.analysisNickname} numberOfLines={2}>
            {share.listData?.name ?? ""}
          </Text>
        </View>
      );
      break;
    case "official":
      body = (
        <View style={styles.textTile}>
          <Text style={styles.reviewQuote} numberOfLines={5}>
            {share.officialText ?? ""}
          </Text>
        </View>
      );
      break;
    case "poll":
      body = (
        <View style={styles.textTile}>
          <Ionicons name="bar-chart" size={18} color={colors.placeholder} style={{ marginBottom: 4 }} />
          <Text style={styles.analysisNickname} numberOfLines={3}>
            {share.pollData?.question ?? ""}
          </Text>
        </View>
      );
      break;
    case "review":
    default:
      body = (
        <View style={styles.textTile}>
          <Text style={styles.reviewQuote} numberOfLines={5}>{`"${share.reviewText ?? ""}"`}</Text>
        </View>
      );
      break;
  }

  return (
    <Pressable style={[styles.tile, style]} onPress={onPress}>
      {body}

      <View style={[styles.badge, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon} size={11} color="#fff" />
      </View>
    </Pressable>
  );
}
