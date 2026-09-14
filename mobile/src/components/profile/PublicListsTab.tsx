import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import ContentRail from "../ContentRail";
import ListRailCard, { LIST_RAIL_CARD_HEIGHT } from "../ListRailCard";
import CollectionPosterCard from "./CollectionPosterCard";
import CollectionSeeAllModal from "./CollectionSeeAllModal";
import PublicCollectionSheet from "./PublicCollectionSheet";
import { PosterRevealProvider } from "../../context/PosterRevealContext";
import { prefetchPublicCollection, type PublicCollectionKind } from "../../api/publicCollectionCache";
import type { CollectionItem, DiscoverListItem, UserCollections } from "../../types";
import type { CollectionEntry } from "../../utils/collectionQuery";

// Matches the Favorites tab's own rail geometry so the two tabs read as the
// same page rather than two different grids.
const COLUMNS = 5;
const GAP = 8;
const RAIL_PADDING = 16;
// Poster (2:3) plus room for the two-line title underneath.
const TITLE_BLOCK = 34;

interface Props {
  collections: UserCollections | undefined;
  userId: string;
  username: string;
}

// The public profile's Lists tab: their lists, what they've watched, and what
// they plan to. Each is a sliding rail. "See all" on the lists rail opens a
// sheet of list cards; on the Watched List and Watchlist rails it opens the
// full list in PublicCollectionSheet — searchable, filterable, read-only.
function PublicListsTab({ collections, userId, username }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [openLists, setOpenLists] = useState(false);
  const [openCollection, setOpenCollection] = useState<PublicCollectionKind | null>(null);
  // A list sheet mounts on its first open and then stays mounted, so its
  // search and filters survive closing it.
  const [mountedKinds, setMountedKinds] = useState<PublicCollectionKind[]>([]);

  const cardWidth = (screenWidth - RAIL_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const railHeight = Math.round(cardWidth * 1.5) + TITLE_BLOCK;
  const basePath = `/user/${userId}` as const;

  const styles = useMemo(() => StyleSheet.create({ wrap: { alignSelf: "stretch" } }), []);

  const lists = collections?.lists ?? [];
  const watched = collections?.watched;
  const watchlist = collections?.watchlist;
  const watchedTotal = watched?.total ?? 0;
  const watchlistTotal = watchlist?.total ?? 0;

  // Warm both full lists as soon as this tab is visited, so opening either
  // sheet shows its grid straight away instead of a skeleton.
  useEffect(() => {
    if (watchedTotal > 0) prefetchPublicCollection(userId, "watched");
    if (watchlistTotal > 0) prefetchPublicCollection(userId, "watchlist");
  }, [userId, watchedTotal, watchlistTotal]);

  const openCollectionSheet = useCallback((kind: PublicCollectionKind) => {
    setMountedKinds((current) => (current.includes(kind) ? current : [...current, kind]));
    setOpenCollection(kind);
  }, []);
  const openWatched = useCallback(() => openCollectionSheet("watched"), [openCollectionSheet]);
  const openWatchlist = useCallback(() => openCollectionSheet("watchlist"), [openCollectionSheet]);
  const closeCollectionSheet = useCallback(() => setOpenCollection(null), []);

  // A sheet is a Modal, which would stay on top of the title's own screen. So
  // opening a title closes the sheet, and it reopens — search and filters
  // intact — when this profile is back in focus.
  const openCollectionRef = useRef(openCollection);
  openCollectionRef.current = openCollection;
  const reopenRef = useRef<PublicCollectionKind | null>(null);

  const openTitle = useCallback(
    (entry: CollectionEntry) => {
      reopenRef.current = openCollectionRef.current;
      setOpenCollection(null);
      router.push(`/user/${userId}/content/${entry.type}/${entry.id}` as never);
    },
    [router, userId]
  );

  useFocusEffect(
    useCallback(() => {
      const kind = reopenRef.current;
      if (!kind) return;
      reopenRef.current = null;
      setOpenCollection(kind);
    }, [])
  );

  const openList = (listId: string) => router.push(`/user/${userId}/lists/${listId}` as never);

  const renderItemCard = (item: CollectionItem, index: number, count: number) => (
    <CollectionPosterCard
      item={item}
      basePath={basePath}
      style={{ width: cardWidth, marginRight: index === count - 1 ? 0 : GAP }}
    />
  );

  return (
    <View style={styles.wrap}>
      {/* Scopes the "only one poster's Detail pill open at a time" behaviour
          to this tab — ListRailCard requires this provider, and Discover
          mounts its own for the same reason. */}
      <PosterRevealProvider>
        <ContentRail
          title={t("Lists")}
          data={lists}
          keyExtractor={(list) => list._id}
          emptyText={t("No public lists yet.")}
          height={LIST_RAIL_CARD_HEIGHT}
          onSeeAllPress={lists.length > 3 ? () => setOpenLists(true) : undefined}
          renderItem={(list) => <ListRailCard list={list} onPress={() => openList(list._id)} />}
        />

        <ContentRail
          title={t("Watched List")}
          data={watched?.items ?? []}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          emptyText={t("Nothing watched yet.")}
          height={railHeight}
          onSeeAllPress={watchedTotal > 0 ? openWatched : undefined}
          renderItem={(item, index) => renderItemCard(item, index, watched?.items.length ?? 0)}
        />

        <ContentRail
          title={t("Watchlist")}
          data={watchlist?.items ?? []}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          emptyText={t("Nothing on the watchlist yet.")}
          height={railHeight}
          onSeeAllPress={watchlistTotal > 0 ? openWatchlist : undefined}
          renderItem={(item, index) => renderItemCard(item, index, watchlist?.items.length ?? 0)}
        />

        <CollectionSeeAllModal
          visible={openLists}
          onClose={() => setOpenLists(false)}
          title={t("Lists")}
          shown={lists.length}
          total={lists.length}
        >
          {/* ListRailCard is a fixed-width card, so it tiles into a wrapping
              grid as-is. */}
          {openLists ? lists.map((list: DiscoverListItem) => (
            <ListRailCard key={list._id} list={list} onPress={() => openList(list._id)} />
          )) : null}
        </CollectionSeeAllModal>
      </PosterRevealProvider>

      {mountedKinds.map((kind) => (
        <PublicCollectionSheet
          key={`${userId}:${kind}`}
          kind={kind}
          visible={openCollection === kind}
          onClose={closeCollectionSheet}
          userId={userId}
          username={username}
          onOpenTitle={openTitle}
        />
      ))}
    </View>
  );
}

// This tab stays mounted once visited (PublicProfileCategoryTabs keeps its
// tabs alive), so memoizing keeps unrelated profile-screen renders from
// walking three rails' worth of cards.
export default memo(PublicListsTab);
