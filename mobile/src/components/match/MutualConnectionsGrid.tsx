import { useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import UserAvatar from "../UserAvatar";
import LockedUnlockNote from "./LockedUnlockNote";
import type { Connection } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const AVATAR_SIZE = 52;
const COLUMNS = 5;
// Exported so MatchAnalysisPanel.tsx can stop paginating past this point
// for a locked (Plus-tier) card, instead of fetching pages this component
// would just slice away again.
export const SOCIAL_LOCKED_VISIBLE_COUNT = 10;

interface Props {
  items: Connection[];
  loadingMore: boolean;
  // True only while the *first* page is in flight — distinct from
  // loadingMore (pagination). Without this, an empty `items` array reads
  // the same whether the fetch genuinely returned zero connections or just
  // hasn't resolved yet.
  initialLoading: boolean;
  // Plus tier — only the first LOCKED_VISIBLE_COUNT mutuals are shown;
  // MatchAnalysisPanel.tsx also stops paginating past the first page when
  // this is true, so there's no real "load more" to gate here beyond the
  // client-side slice.
  locked?: boolean;
}

// Plain wrapping grid, not a FlatList — every card in MatchAnalysisPanel
// already renders inside its own per-card vertical ScrollView, nested inside
// the outer horizontal card-paging ScrollView (different axis, no gesture
// conflict). "Load more as you scroll down inside the card" hooks into that
// existing ScrollView's onScroll instead of adding a second nested
// scrollable, which would risk the same class of same-axis nested-scroll bug
// PosterRow.tsx/PosterCoverflow.tsx already had to work around elsewhere in
// this feature.
export default function MutualConnectionsGrid({ items, loadingMore, initialLoading, locked }: Props) {
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

  // Checked before the empty-state text below — without it, "haven't
  // fetched the first page yet" and "fetched, genuinely zero connections"
  // both read as an empty `items` array and showed the identical "No
  // mutual connections yet." message, actively misleading for however long
  // the fetch (gated behind MatchAnalysisPanel's own shouldLoadExtras) is
  // still in flight once this card is actually visible.
  if (initialLoading) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

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

  const visibleItems = locked ? items.slice(0, SOCIAL_LOCKED_VISIBLE_COUNT) : items;

  return (
    <View>
      <View style={styles.grid}>
        {visibleItems.map((item) => (
          <View key={item._id} style={styles.cell}>
            <UserAvatar userId={item._id} username={item.username} profilePicUrl={item.profile_pic_url} size={AVATAR_SIZE} />
            <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
              {item.username}
            </Text>
          </View>
        ))}
      </View>
      {locked && items.length > visibleItems.length ? (
        <LockedUnlockNote label={t("Showing {{shown}} of {{total}}", { shown: visibleItems.length, total: items.length })} />
      ) : (
        loadingMore && (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )
      )}
    </View>
  );
}
