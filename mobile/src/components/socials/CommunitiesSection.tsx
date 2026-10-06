import { useCallback, useMemo } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
// Gesture handler's Pressable: see MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCommunities } from "../../hooks/useCommunities";
import { roomKey, roomPrefetch } from "../../api/chatCache";
import { activeCommunityFilterCount, queryCommunities, type CommunityAction, type CommunityFilters } from "../../utils/communities";
import CommunityCard, { createCommunityCardStyles } from "./CommunityCard";
import YourCommunityCard, { createYourCommunityCardStyles } from "./YourCommunityCard";
import { isDarkTheme } from "./communityCategory";
import { SkeletonGroupCard } from "../Skeleton";
import type { Group } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import AdBanner from "../ads/AdBanner";
import { AD_UNIT_IDS } from "../../constants/adUnitIds";

// "Her kutucukta bir çıkmasın yoksa çok reklama boğulur" — same every-6th
// cadence as every other inline card-feed placement in this app.
const AD_INTERVAL = 6;

interface Props {
  filters: CommunityFilters;
  dispatch: (action: CommunityAction) => void;
}

// The Communities tab: every community as a card, for browsing. Filter and
// Sort live in the header (CommunityFilterPopover, CommunitySortPopover), and joining happens on a
// community's own page.
//
// Renders from the shared cache (communitiesStore.ts), so coming back to the
// tab — or to the app's Socials screen at all, once it has loaded — shows the
// list on the first frame and refreshes it underneath.
export default function CommunitiesSection({ filters, dispatch }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { groups, failed, refreshing, refresh } = useCommunities();
  const dark = isDarkTheme(colors);
  const cardStyles = useMemo(() => createCommunityCardStyles(colors), [colors]);
  const yourCardStyles = useMemo(() => createYourCommunityCardStyles(colors), [colors]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
        summary: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder, marginBottom: 12, marginLeft: 2 },
        state: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
        stateIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          marginBottom: 6,
        },
        stateText: { fontSize: 15, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
        stateButton: {
          marginTop: 6,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 10,
          backgroundColor: colors.base200,
        },
        stateButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
      }),
    [colors]
  );

  // In memory over the cached list, so a sort or filter change is instant.
  const shown = useMemo(() => (groups ? queryCommunities(groups, filters) : []), [groups, filters]);
  const narrowed = activeCommunityFilterCount(filters) > 0;

  // Pinned above the browsable list regardless of filter/sort, so the
  // admin never has to search for their own community — derived for free
  // from the list `getAllGroups` already fetches (owner is populated
  // server-side), no extra request.
  const myCommunity = useMemo(() => groups?.find((g) => g.owner?._id === user?._id) ?? null, [groups, user?._id]);

  const open = useCallback((group: Group) => router.push(`/socials/communities/${group.slug}`), [router]);

  // A community opens on its chat, so a member's touch starts loading it.
  const warm = useCallback((group: Group) => {
    if (group.isMember) roomPrefetch.prefetch(roomKey("group", group._id));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Group; index: number }) => (
      <>
        <CommunityCard group={item} dark={dark} styles={cardStyles} onPress={open} onPressIn={warm} />
        {(index + 1) % AD_INTERVAL === 0 && <AdBanner unitId={AD_UNIT_IDS.SOCIALS_BANNER} />}
      </>
    ),
    [dark, cardStyles, open, warm]
  );

  if (!groups) {
    if (failed) {
      return (
        <View style={[styles.container, styles.state]}>
          <View style={styles.stateIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.placeholder} />
          </View>
          <Text style={styles.stateText}>{t("Failed to load groups")}</Text>
          <Pressable style={({ pressed }) => [styles.stateButton, pressed && { opacity: 0.7 }]} onPress={refresh}>
            <Text style={styles.stateButtonText}>{t("Try again")}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.list]}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonGroupCard key={i} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={shown}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      initialNumToRender={6}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        myCommunity || (narrowed && shown.length > 0) ? (
          <>
            {myCommunity ? <YourCommunityCard group={myCommunity} styles={yourCardStyles} onPress={open} /> : null}
            {narrowed && shown.length > 0 ? (
              <Text style={styles.summary}>
                {t("{{shown}} of {{total}} communities", { shown: shown.length, total: groups.length })}
              </Text>
            ) : null}
          </>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="people-outline" size={28} color={colors.placeholder} />
          </View>
          <Text style={styles.stateText}>
            {t(filters.show === "joined" && filters.category === "all" ? "You haven't joined any communities yet." : "No groups in this category.")}
          </Text>
          {narrowed ? (
            <Pressable
              style={({ pressed }) => [styles.stateButton, pressed && { opacity: 0.7 }]}
              onPress={() => dispatch({ kind: "clearFilters" })}
            >
              <Text style={styles.stateButtonText}>{t("Show all communities")}</Text>
            </Pressable>
          ) : null}
        </View>
      }
    />
  );
}
