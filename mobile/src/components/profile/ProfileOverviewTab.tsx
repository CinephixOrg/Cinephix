import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getWatchlist } from "../../api/watchlistService";
import { getToWatchList } from "../../api/toWatchService";
import { getMovieById, getSeriesById } from "../../api/contentService";
import { getFeed } from "../../api/feedService";
import ContentRail from "../ContentRail";
import ContentCard from "../ContentCard";
import FeedItemRow from "../FeedItemRow";
import EditFavoritesModal, { type FavoritePickItem } from "./EditFavoritesModal";
import type { ContentType, Favorites, FeedActivityItem, Movie, Series } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const PREVIEW_COUNT = 8;
// Fixed sizing for the grouped rails (Favorite Movies/Series, Watched List,
// Watchlist) so all four read as one consistent grid rather than four
// independently-sized sections.
const RAIL_CARD_WIDTH = 110;
const RAIL_HEIGHT = 250;

interface HydratedItem {
  id: string;
  type: ContentType;
  content: Movie | Series;
}

interface Props {
  favorites: Favorites | null;
}

export default function ProfileOverviewTab({ favorites }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        activitySection: { marginBottom: 24, alignSelf: "stretch", paddingHorizontal: 16 },
        titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        seeAll: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
        empty: { color: colors.placeholder, fontSize: 13, marginTop: 8 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
      }),
    [colors]
  );

  const [localFavorites, setLocalFavorites] = useState(favorites);
  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);

  const [editingType, setEditingType] = useState<ContentType | null>(null);

  const handleFavoritesSaved = (type: ContentType, items: FavoritePickItem[]) => {
    setLocalFavorites((prev) => {
      const prevMovies = prev?.isAuthorized ? prev.movies : [];
      const prevSeries = prev?.isAuthorized ? prev.series : [];
      return {
        isAuthorized: true,
        movies:
          type === "movie"
            ? items.map((i) => ({ _id: i._id, title: i.label, poster_path: i.poster_path }))
            : prevMovies,
        series:
          type === "series"
            ? items.map((i) => ({ _id: i._id, name: i.label, poster_path: i.poster_path }))
            : prevSeries,
      };
    });
  };

  const [watchedItems, setWatchedItems] = useState<HydratedItem[]>([]);
  const [toWatchItems, setToWatchItems] = useState<HydratedItem[]>([]);
  const [feedItems, setFeedItems] = useState<FeedActivityItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const hydrate = async (items: { itemId: string; itemType: ContentType }[]): Promise<HydratedItem[]> => {
        const slice = items.slice(0, PREVIEW_COUNT);
        const hydrated = await Promise.all(
          slice.map(async (w) => {
            const content = w.itemType === "movie" ? await getMovieById(w.itemId) : await getSeriesById(w.itemId);
            return { id: w.itemId, type: w.itemType, content };
          })
        );
        return hydrated;
      };

      (async () => {
        try {
          const [watchlist, toWatchList, feedRes] = await Promise.all([
            getWatchlist(),
            getToWatchList(),
            getFeed(1, 5),
          ]);
          if (cancelled) return;
          const [hydratedWatched, hydratedToWatch] = await Promise.all([
            hydrate(watchlist),
            hydrate(toWatchList),
          ]);
          if (cancelled) return;
          setWatchedItems(hydratedWatched);
          setToWatchItems(hydratedToWatch);
          setFeedItems(feedRes.items);
        } catch {
          // Best-effort preview data — leave sections empty on failure rather
          // than blocking the rest of the profile tab.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <>
      {localFavorites && (
        <>
          <ContentRail
            title={t("Favorite Movies")}
            data={localFavorites.movies}
            keyExtractor={(m) => m._id}
            emptyText={t("No favorite movies yet.")}
            height={RAIL_HEIGHT}
            onEditPress={() => setEditingType("movie")}
            editLabel={t("Edit Favorite Movies")}
            renderItem={(m) => (
              <ContentCard
                id={m._id}
                type="movie"
                title={m.title}
                posterPath={m.poster_path}
                basePath="/profile"
                style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
              />
            )}
          />
          <ContentRail
            title={t("Favorite Series")}
            data={localFavorites.series}
            keyExtractor={(s) => s._id}
            emptyText={t("No favorite series yet.")}
            height={RAIL_HEIGHT}
            onEditPress={() => setEditingType("series")}
            editLabel={t("Edit Favorite Series")}
            renderItem={(s) => (
              <ContentCard
                id={s._id}
                type="series"
                title={s.name}
                posterPath={s.poster_path}
                basePath="/profile"
                style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
              />
            )}
          />
        </>
      )}

      <ContentRail
        title={t("Watched List")}
        data={watchedItems}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        emptyText={t("Your watched list is empty.")}
        height={RAIL_HEIGHT}
        onSeeAllPress={() => router.push("/watchlist")}
        seeAllLabel={t("See all")}
        renderItem={(item) => (
          <ContentCard
            id={item.id}
            type={item.type}
            title={item.type === "movie" ? (item.content as Movie).title : (item.content as Series).name}
            posterPath={item.content.poster_path}
            basePath="/profile"
            style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
          />
        )}
      />

      <ContentRail
        title={t("Watchlist")}
        data={toWatchItems}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        emptyText={t("Your watchlist is empty.")}
        height={RAIL_HEIGHT}
        onSeeAllPress={() => router.push("/to-watch")}
        seeAllLabel={t("See all")}
        renderItem={(item) => (
          <ContentCard
            id={item.id}
            type={item.type}
            title={item.type === "movie" ? (item.content as Movie).title : (item.content as Series).name}
            posterPath={item.content.poster_path}
            basePath="/profile"
            style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
          />
        )}
      />

      <View style={styles.activitySection}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("Activity")}</Text>
          <Text style={styles.seeAll} onPress={() => router.push("/home")}>
            {t("See all")}
          </Text>
        </View>
        {feedItems.length === 0 ? (
          <Text style={styles.empty}>{t("No recent activity yet.")}</Text>
        ) : (
          feedItems.map((item, i) => (
            <View key={`${item.type}-${item.user._id}-${item.createdAt}-${i}`}>
              <FeedItemRow item={item} />
              {i < feedItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </View>

      <EditFavoritesModal
        visible={editingType !== null}
        type={editingType ?? "movie"}
        favorites={editingType === "series" ? localFavorites?.series ?? [] : localFavorites?.movies ?? []}
        onClose={() => setEditingType(null)}
        onSaved={handleFavoritesSaved}
      />
    </>
  );
}
