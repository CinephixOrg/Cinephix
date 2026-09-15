import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { getCurrentlyWatchingFeed, type CurrentlyWatchingFeedItem } from "../../api/feedService";
import ContentRail from "../ContentRail";
import CurrentlyWatchingCard from "./CurrentlyWatchingCard";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const RAIL_COUNT = 20;
const CARD_GAP = 12;

type Scope = "all" | "friends";

// Discover's "Currently Watching" rail — who's actively watching what
// right now (1-day TTL, feedController.js's getCurrentlyWatchingFeed), a
// live status roster rather than a Medya post, direct ask. The All/Friends
// mode toggle is a plain two-segment pill (not CineGraphSubTabSwitcher's
// animated capsule — that component is hardcoded to movie/series) sitting
// in ContentRail's new headerRight slot. Defaults to "all" rather than
// "friends" since this is a brand-new, still-sparse feature — starting on
// the wider scope keeps it visible/discoverable more often; a viewer with
// an active network can switch to "friends" themselves.
export default function CurrentlyWatchingSection({ basePath }: { basePath: "/home" | "/socials" }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [scope, setScope] = useState<Scope>("all");
  const [items, setItems] = useState<CurrentlyWatchingFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCurrentlyWatchingFeed(scope, RAIL_COUNT)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, [scope]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toggle: { flexDirection: "row", backgroundColor: colors.base300, borderRadius: 999, padding: 2 },
        segment: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
        segmentActive: { backgroundColor: colors.primary },
        segmentText: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        segmentTextActive: { color: colors.primaryContent, fontFamily: fonts.bold },
      }),
    [colors]
  );

  // Loading is the only state that hides this entirely — same corrected
  // convention OnlineFriendsBar.tsx's own doc comment already establishes
  // ("a genuinely empty result now always shows the informational empty
  // state instead of disappearing"), direct ask to match it here too. A
  // dangling section divider with nothing above it (the earlier
  // hide-when-empty behavior) was the actual bug being fixed — always
  // rendering the section (title + toggle + ContentRail's own emptyText)
  // once loaded means there's never an orphaned divider, and the toggle
  // stays reachable regardless of which scope currently has nobody in it.
  if (!loaded) return null;

  return (
    <ContentRail
      title={t("Currently Watching")}
      data={items}
      keyExtractor={(item) => `${item.user._id}-${item.contentId}`}
      emptyText={scope === "friends" ? t("None of your friends are watching anything right now.") : t("Nobody is watching anything right now.")}
      headerRight={
        <View style={styles.toggle}>
          <Pressable style={[styles.segment, scope === "all" && styles.segmentActive]} onPress={() => setScope("all")}>
            <Text style={[styles.segmentText, scope === "all" && styles.segmentTextActive]}>{t("All")}</Text>
          </Pressable>
          <Pressable style={[styles.segment, scope === "friends" && styles.segmentActive]} onPress={() => setScope("friends")}>
            <Text style={[styles.segmentText, scope === "friends" && styles.segmentTextActive]}>{t("Friends")}</Text>
          </Pressable>
        </View>
      }
      renderItem={(item) => <CurrentlyWatchingCard item={item} basePath={basePath} style={{ marginRight: CARD_GAP }} />}
    />
  );
}
