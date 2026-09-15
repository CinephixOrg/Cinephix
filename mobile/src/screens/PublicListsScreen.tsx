import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { fetchPublicProfileCollections, getCachedCollections } from "../api/publicProfileCache";
import DiscoverListCard from "../components/DiscoverListCard";
import CollectionSearchBar from "../components/collection/CollectionSearchBar";
import CollectionToolbar from "../components/collection/CollectionToolbar";
import { CollectionStateView } from "../components/collection/CollectionStates";
import ListCardSkeleton from "../components/lists/ListCardSkeleton";
import { buildNamedIndex, searchNamed } from "../utils/collectionQuery";
import { sameShape } from "../utils/cache";
import type { DiscoverListItem } from "../types";
import { useOwnerTitle } from "../hooks/useOwnerTitle";

const PADDING_X = 16;
const SKELETON_CARDS = [0, 1, 2, 3];
// CollectionToolbar's height, held while loading.
const TOOLBAR_HEIGHT = 36;

type Status = "loading" | "ready" | "error";

const nameOf = (list: DiscoverListItem) => list.name;
const keyOf = (list: DiscoverListItem) => list._id;

// Someone else's public lists, as a full page in their profile's stack
// (/user/[id]/lists), opened from their profile's drawer. The signed-in
// user's own Lists page (MyListsScreen) without anything that changes a list:
// the same search by name and the same cards, and no Edit, no New List, no
// delete.
//
// The lists come from the profile's collections cache (warmed when the
// profile, or its drawer, opens): a revisit renders them on the first frame
// and refreshes underneath.
function PublicListsScreen() {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  useOwnerTitle(userId, "@{{username}}'s Lists", "Lists");

  const [lists, setLists] = useState<DiscoverListItem[]>(() => (userId ? getCachedCollections(userId)?.lists : undefined) ?? []);
  const [status, setStatus] = useState<Status>(() => (userId && getCachedCollections(userId) ? "ready" : "loading"));
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    return fetchPublicProfileCollections(userId)
      .then((result) => {
        setLists((previous) => (sameShape(previous, result.lists) ? previous : result.lists));
        setStatus("ready");
      })
      .catch(() => {
        if (!getCachedCollections(userId)) setStatus("error");
      });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    load();
  }, [load]);

  const index = useMemo(() => buildNamedIndex(lists, nameOf), [lists]);
  // The count is exact on the frame of a keystroke; the list follows at low priority.
  const visible = useMemo(() => searchNamed(index, query), [index, query]);
  const shown = useDeferredValue(visible);
  const narrowed = query.trim().length > 0;

  const basePath = `/user/${userId}` as const;
  const renderItem: ListRenderItem<DiscoverListItem> = useCallback(
    ({ item }) => (
      <DiscoverListCard list={item} basePath={basePath} onPress={() => router.push(`/user/${userId}/lists/${item._id}` as never)} />
    ),
    [basePath, router, userId]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        top: { paddingHorizontal: PADDING_X, paddingTop: 12, paddingBottom: 10, gap: 10 },
        toolbarPlaceholder: { alignSelf: "flex-start", height: TOOLBAR_HEIGHT },
        list: { paddingHorizontal: PADDING_X, paddingTop: 4, paddingBottom: 32 },
        skeleton: { paddingHorizontal: PADDING_X, paddingTop: 4 },
      }),
    [colors]
  );

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <View style={styles.skeleton}>
        {SKELETON_CARDS.map((card) => (
          <ListCardSkeleton key={card} />
        ))}
      </View>
    );
  } else if (status === "error") {
    body = (
      <CollectionStateView
        icon="cloud-offline-outline"
        title={t("Failed to load lists.")}
        text={t("Check your connection and try again.")}
        action={{ label: t("Retry"), onPress: retry }}
      />
    );
  } else if (lists.length === 0) {
    body = <CollectionStateView icon="albums-outline" title={t("No public lists yet.")} />;
  } else if (visible.length === 0) {
    body = <CollectionStateView icon="search-outline" title={t("No lists match your search.")} text={t("Try a different list name.")} />;
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={keyOf}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <CollectionSearchBar placeholder={t("Search lists")} onChangeQuery={setQuery} />
        {status === "ready" && lists.length > 0 ? (
          <CollectionToolbar
            shown={visible.length}
            total={lists.length}
            narrowed={narrowed}
            countLabel={
              narrowed
                ? t("{{shown}} of {{total}} lists", { shown: visible.length, total: lists.length })
                : t("{{count}} lists", { count: lists.length })
            }
          />
        ) : status === "loading" ? (
          <ActivityIndicator size="small" color={colors.placeholder} style={styles.toolbarPlaceholder} />
        ) : null}
      </View>
      {body}
    </View>
  );
}

export default memo(PublicListsScreen);
