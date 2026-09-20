import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
// From react-native-gesture-handler, not react-native, matching every other
// nested scroller inside KesfetSection's own outer ScrollView (see that
// file's own doc comment on why) — this box's own inner scroll needs the
// same gesture-handler pan resolution to coexist with the outer one.
import { ScrollView, Pressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getNetworkActivity } from "../../api/feedService";
import ActivityRow from "../ActivityRow";
import { SkeletonBox } from "../Skeleton";
import type { ActivityEvent } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { useWithoutBlocked } from "../../hooks/useBlocked";

const activityActor = (event: ActivityEvent) => event.actor?._id;

// Fetches enough for a real scroll (not just the visible 6) — the box
// itself is capped to roughly 6 rows tall and scrolls internally for the
// rest, direct ask ("boyutu 6 activity kadar alabilecek ve alta
// kaydırdıkça devamı gelecek"). Not the full infinite list — "See all"
// (ActivityFeedSection.tsx) already exists for that; this is just enough
// to make the preview's own inner scroll feel real rather than immediately
// hitting a wall a row or two past the fold.
const FETCH_COUNT = 20;
// Tuned to ActivityRow's own real row height (icon+2-line sentence, plus
// this box's divider) rather than measured live — good enough for "roughly
// 6 rows," not required to be exact to the pixel.
const ROW_HEIGHT_ESTIMATE = 56;
const VISIBLE_ROWS = 6;
const BOX_HEIGHT = ROW_HEIGHT_ESTIMATE * VISIBLE_ROWS;

interface Props {
  onSeeAllPress?: () => void;
}

// A fixed-height, internally-scrolling box (not a plain stack anymore) —
// direct ask, "reviewsa basınca açılan pencere gibi düşün: devamı var,
// kaydırdıkça görüyorsun." Same gesture-handler ScrollView every other
// nested scroller on this page already uses (see import comment) rather
// than a FlatList — this is a small, bounded preview, not an
// independently-paginated list; "See all" is where real pagination lives.
// A small down-chevron hint sits fixed at the box's own bottom edge
// whenever there's more than fits on screen, so it doesn't read as "that's
// all of it" — same idea as a scroll-shadow affordance, just an icon
// instead of a gradient fade. Owns its own fetch (GET /feed/activity), same
// self-contained pattern LeaderboardPodium already uses, rather than being
// threaded through KesfetSection's own Promise.all — this section has
// nothing else on the page depending on its data. See ActivityRow.tsx's
// own doc comment for why rows are icon-led rather than full translated
// sentences.
export default function ActivitySection({ onSeeAllPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const visibleItems = useWithoutBlocked(items, activityActor);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNetworkActivity(1, FETCH_COUNT).then((res) => {
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
        box: { height: BOX_HEIGHT },
        list: { paddingHorizontal: 16 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        empty: { color: colors.placeholder, fontSize: 13, paddingHorizontal: 16, marginTop: 8 },
        skeletonWrap: { paddingHorizontal: 16, gap: 10 },
        scrollHint: { alignItems: "center", marginTop: -4 },
      }),
    [colors]
  );

  // See ActivityFeedSection.tsx's own identical helper for why the
  // content-less types (followed/shared/podium) each need their own
  // fallback distinguisher here.
  const eventKey = (e: ActivityEvent) => {
    const distinguisher =
      "content" in e ? e.content.id : e.type === "followed" ? e.targetUser?._id ?? "" : e.type === "shared" ? e.shareType : `${e.category}-${e.rank}`;
    return `${e.type}-${e.actor._id}-${e.createdAt}-${distinguisher}`;
  };

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
      ) : visibleItems.length === 0 ? (
        <Text style={styles.empty}>{t("No activity yet.")}</Text>
      ) : (
        <>
          <ScrollView style={styles.box} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View style={styles.list}>
              {visibleItems.map((event, i) => (
                <View key={eventKey(event)}>
                  <ActivityRow event={event} basePath="/home" />
                  {i < visibleItems.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </ScrollView>
          {visibleItems.length > VISIBLE_ROWS && (
            <View style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={16} color={colors.placeholder} />
            </View>
          )}
        </>
      )}
    </View>
  );
}
