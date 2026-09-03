import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getNetworkActivity } from "../../api/feedService";
import ActivityRow from "../ActivityRow";
import { SkeletonBox } from "../Skeleton";
import type { ActivityEvent } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const PREVIEW_COUNT = 6;

interface Props {
  onSeeAllPress?: () => void;
}

// A compact, plain vertical stack (not a FlatList — same reasoning
// DiscoverListCard's old preview used before it moved to a rail: this is
// a small, fixed-count preview inside KesfetSection's own vertical
// ScrollView, not an independently-scrolling list, so nesting a second
// vertical scroller here would be the exact same anti-pattern already
// established and avoided elsewhere on this page). Owns its own fetch
// (GET /feed/activity), same self-contained pattern LeaderboardPodium
// already uses, rather than being threaded through KesfetSection's own
// Promise.all — this section has nothing else on the page depending on
// its data. See ActivityRow.tsx's own doc comment for why rows are
// icon-led rather than full translated sentences.
export default function ActivitySection({ onSeeAllPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNetworkActivity(1, PREVIEW_COUNT).then((res) => {
      if (!cancelled) {
        setItems(res.items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 24 },
        titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 4 },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        seeAll: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
        list: { paddingHorizontal: 16 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        empty: { color: colors.placeholder, fontSize: 13, paddingHorizontal: 16, marginTop: 8 },
        skeletonWrap: { paddingHorizontal: 16, gap: 10 },
      }),
    [colors]
  );

  const eventKey = (e: ActivityEvent) => `${e.type}-${e.actor._id}-${e.createdAt}-${e.content.id}`;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("Friends' Activity")}</Text>
        {onSeeAllPress && (
          <Pressable onPress={onSeeAllPress} hitSlop={8}>
            <Text style={styles.seeAll}>{t("See all")}</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} width="100%" height={60} borderRadius={8} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t("No activity yet.")}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((event, i) => (
            <View key={eventKey(event)}>
              <ActivityRow event={event} basePath="/home" />
              {i < items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
