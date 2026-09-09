import { memo, useMemo, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import ContentRail from "../ContentRail";
import ListRailCard, { LIST_RAIL_CARD_HEIGHT } from "../ListRailCard";
import CollectionPosterCard from "./CollectionPosterCard";
import CollectionSeeAllModal, {
  SEE_ALL_GRID_GAP,
  SEE_ALL_OVERLAY_PADDING,
  SEE_ALL_SHEET_PADDING,
} from "./CollectionSeeAllModal";
import { PosterRevealProvider } from "../../context/PosterRevealContext";
import type { CollectionItem, CollectionSlice, DiscoverListItem, UserCollections } from "../../types";

// Matches the Favorites tab's own rail geometry so the two tabs read as the
// same page rather than two different grids.
const COLUMNS = 5;
const GAP = 8;
const RAIL_PADDING = 16;
// Poster (2:3) plus room for the two-line title underneath.
const TITLE_BLOCK = 34;
// The sheet lays posters out wider than the rail does — three across rather
// than five, since there's a whole screen of height to fill.
const SHEET_COLUMNS = 3;

interface Props {
  collections: UserCollections | undefined;
  userId: string;
}

// Which rail's "See all" sheet is open. One piece of state rather than three
// booleans, since only one sheet is ever open at a time.
type OpenSheet =
  | { kind: "items"; title: string; slice: CollectionSlice }
  | { kind: "lists"; title: string; lists: DiscoverListItem[] }
  | null;

// The public profile's Lists tab: their lists, what they've watched, and
// what they plan to. Each is a sliding rail with a "See all" sheet behind
// it, matching how Favorites presents its two rails one tab over.
function PublicListsTab({ collections, userId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);

  const cardWidth = (screenWidth - RAIL_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const railHeight = Math.round(cardWidth * 1.5) + TITLE_BLOCK;
  // The sheet's own content box: screen minus the overlay's padding, minus
  // the sheet's.
  const sheetGridWidth = screenWidth - SEE_ALL_OVERLAY_PADDING * 2 - SEE_ALL_SHEET_PADDING * 2;
  const sheetCardWidth = (sheetGridWidth - SEE_ALL_GRID_GAP * (SHEET_COLUMNS - 1)) / SHEET_COLUMNS;
  const basePath = `/user/${userId}` as const;

  const styles = useMemo(() => StyleSheet.create({ wrap: { alignSelf: "stretch" } }), []);

  const lists = collections?.lists ?? [];
  const watched = collections?.watched;
  const watchlist = collections?.watchlist;

  const openList = (listId: string) => router.push(`/user/${userId}/lists/${listId}` as never);

  const renderItemCard = (item: CollectionItem, index: number, count: number) => (
    <CollectionPosterCard
      item={item}
      basePath={basePath}
      style={{ width: cardWidth, marginRight: index === count - 1 ? 0 : GAP }}
    />
  );

  // A rail only offers "See all" when the sheet would show more at once than
  // the rail already does — below that the button just reformats what's
  // already on screen, since the rail scrolls anyway.
  const itemsSeeAll = (title: string, slice: CollectionSlice | undefined) =>
    slice && slice.items.length > COLUMNS ? () => setOpenSheet({ kind: "items", title, slice }) : undefined;

  return (
    <View style={styles.wrap}>
      {/* Scopes the "only one poster's Detail pill open at a time" behaviour
          to this tab — ListRailCard requires this provider, and Discover
          mounts its own for the same reason. Wraps the sheet too, since the
          same cards render inside it. */}
      <PosterRevealProvider>
        <ContentRail
          title={t("Lists")}
          data={lists}
          keyExtractor={(list) => list._id}
          emptyText={t("No public lists yet.")}
          height={LIST_RAIL_CARD_HEIGHT}
          onSeeAllPress={lists.length > 3 ? () => setOpenSheet({ kind: "lists", title: t("Lists"), lists }) : undefined}
          renderItem={(list) => <ListRailCard list={list} onPress={() => openList(list._id)} />}
        />

        <ContentRail
          title={t("Watched List")}
          data={watched?.items ?? []}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          emptyText={t("Nothing watched yet.")}
          height={railHeight}
          onSeeAllPress={itemsSeeAll(t("Watched List"), watched)}
          renderItem={(item, index) => renderItemCard(item, index, watched?.items.length ?? 0)}
        />

        <ContentRail
          title={t("Watchlist")}
          data={watchlist?.items ?? []}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          emptyText={t("Nothing on the watchlist yet.")}
          height={railHeight}
          onSeeAllPress={itemsSeeAll(t("Watchlist"), watchlist)}
          renderItem={(item, index) => renderItemCard(item, index, watchlist?.items.length ?? 0)}
        />

        <CollectionSeeAllModal
          visible={openSheet !== null}
          onClose={() => setOpenSheet(null)}
          title={openSheet?.title ?? ""}
          shown={openSheet?.kind === "lists" ? openSheet.lists.length : openSheet?.slice.items.length ?? 0}
          total={openSheet?.kind === "lists" ? openSheet.lists.length : openSheet?.slice.total ?? 0}
        >
          {openSheet?.kind === "lists"
            ? openSheet.lists.map((list) => (
                // ListRailCard is a fixed-width card, so it tiles into a
                // wrapping grid as-is.
                <ListRailCard key={list._id} list={list} onPress={() => openList(list._id)} />
              ))
            : openSheet?.slice.items.map((item) => (
                <CollectionPosterCard
                  key={`${item.itemType}:${item.itemId}`}
                  item={item}
                  basePath={basePath}
                  style={{ width: sheetCardWidth }}
                />
              ))}
        </CollectionSeeAllModal>
      </PosterRevealProvider>
    </View>
  );
}

// This tab stays mounted once visited (PublicProfileCategoryTabs keeps its
// tabs alive), so memoizing keeps unrelated profile-screen renders from
// walking three rails' worth of cards.
export default memo(PublicListsTab);
