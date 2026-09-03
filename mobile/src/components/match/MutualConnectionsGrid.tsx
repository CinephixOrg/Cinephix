import { useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import UserAvatar from "../UserAvatar";
import type { Connection } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const AVATAR_SIZE = 52;
const COLUMNS = 5;

interface Props {
  items: Connection[];
  loadingMore: boolean;
}

// Plain wrapping grid, not a FlatList — every card in MatchAnalysisPanel
// already renders inside its own per-card vertical ScrollView, nested inside
// the outer horizontal card-paging ScrollView (different axis, no gesture
// conflict). "Load more as you scroll down inside the card" hooks into that
// existing ScrollView's onScroll instead of adding a second nested
// scrollable, which would risk the same class of same-axis nested-scroll bug
// PosterRow.tsx/PosterCoverflow.tsx already had to work around elsewhere in
// this feature.
export default function MutualConnectionsGrid({ items, loadingMore }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: { flexDirection: "row", flexWrap: "wrap" },
        cell: { width: `${100 / COLUMNS}%`, alignItems: "center", marginBottom: 16 },
        username: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 6, textAlign: "center", maxWidth: AVATAR_SIZE + 12 },
        footer: { width: "100%", alignItems: "center", paddingVertical: 12 },
        emptyText: { fontSize: 12.5, color: colors.placeholder, lineHeight: 18, textAlign: "center" },
      }),
    [colors]
  );

  // Same "the card stays, only its body explains there's nothing here"
  // convention every other card in this panel already follows (Shared
  // Genres' "Neither of you has rated anything...", Activity's "Nothing
  // you've both rated...") — this used to be the one card that vanished
  // outright (MatchAnalysisPanel.tsx gated pushing it at all on
  // mutualFollowing > 0), a real inconsistency: zero mutual connections is
  // exactly as legitimate a result as zero shared genres, not a reason to
  // hide the card.
  if (items.length === 0) {
    return <Text style={styles.emptyText}>{t("No mutual connections yet.")}</Text>;
  }

  return (
    <View>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item._id} style={styles.cell}>
            <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={AVATAR_SIZE} />
            <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
              {item.username}
            </Text>
          </View>
        ))}
      </View>
      {loadingMore && (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
