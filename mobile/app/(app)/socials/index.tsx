import { useCallback, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
// Gesture handler's Pressable: see src/components/socials/MessagesSection.tsx for why.
import { Pressable } from "react-native-gesture-handler";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MessagesSection from "../../../src/components/socials/MessagesSection";
import CommunitiesSection from "../../../src/components/socials/CommunitiesSection";
import CommunityFilterButton from "../../../src/components/socials/CommunityFilterPopover";
import CommunitySortButton from "../../../src/components/socials/CommunitySortPopover";
import CapsuleTabSwitcher, { type CapsuleTabOption } from "../../../src/components/CapsuleTabSwitcher";
import { DEFAULT_COMMUNITY_FILTERS, reduceCommunityFilters, type CommunityAction } from "../../../src/utils/communities";
import { useTheme } from "../../../src/context/ThemeContext";

type MainTab = "messages" | "communities";

// A filter or sort change fades cards out and slides the rest into place,
// instead of the list jumping to its new contents.
const REFLOW = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

function HeaderIcon({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.base300 }]}
    >
      <Ionicons name={icon} size={22} color={colors.baseContent} />
    </Pressable>
  );
}

// Same lazy-mount-once-then-display:none shell as home/index.tsx and
// search/index.tsx, with the Messages/Community switcher as the header title.
//
// The header also carries each tab's actions — Recommend and New Message for
// Messages, the Filter and Sort menus for Communities — so neither tab spends a row of
// its own on a couple of icons.
export default function SocialsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();

  // `?tab=communities` deep-links straight to Community (an official-
  // account tip's "Group" link uses this) — otherwise defaults to Messages.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: MainTab = tabParam === "communities" ? "communities" : "messages";
  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<MainTab>>(() => new Set([initialTab]));
  // Filters and sorts together, in the same reducer the menus' tests cover
  // (utils/communities.ts). Sorting reorders the cached list in memory — no
  // request, no loading state.
  const [filters, dispatchFilters] = useReducer(reduceCommunityFilters, DEFAULT_COMMUNITY_FILTERS);

  const switchTab = useCallback((tab: MainTab) => {
    setMainTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, []);

  const changeFilters = useCallback((action: CommunityAction) => {
    LayoutAnimation.configureNext(REFLOW);
    dispatchFilters(action);
  }, []);

  const tabOptions = useMemo<[CapsuleTabOption<MainTab>, CapsuleTabOption<MainTab>]>(
    () => [
      { key: "messages", label: t("Messages"), icon: "chatbubble-outline" },
      { key: "communities", label: t("Community"), icon: "people-outline" },
    ],
    [t]
  );

  // A layout effect, so the header's actions are in place on the first frame.
  // Depends only on what the header shows (tab, filters and sorts), so nothing else —
  // the inbox updating, a community refreshing while a chat is open on top —
  // makes this screen push new header options.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <CapsuleTabSwitcher activeKey={mainTab} onChange={switchTab} options={tabOptions} />,
      headerLeft: () => (
        <View style={styles.headerActions}>
          {mainTab === "messages" ? (
            <>
              <HeaderIcon icon="gift-outline" label={t("Recommend")} onPress={() => router.push("/socials/messages/recommend")} />
              <HeaderIcon icon="create-outline" label={t("New Message")} onPress={() => router.push("/socials/messages/new")} />
            </>
          ) : (
            <>
              <CommunityFilterButton filters={filters} dispatch={changeFilters} />
              <CommunitySortButton filters={filters} dispatch={changeFilters} />
            </>
          )}
        </View>
      ),
    });
  }, [navigation, mainTab, switchTab, tabOptions, filters, changeFilters, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.base100 }]}>
      <View style={[styles.page, mainTab !== "messages" && styles.hidden]}>
        {visitedTabs.has("messages") && <MessagesSection />}
      </View>
      <View style={[styles.page, mainTab !== "communities" && styles.hidden]}>
        {visitedTabs.has("communities") && <CommunitiesSection filters={filters} dispatch={changeFilters} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1 },
  hidden: { display: "none" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
