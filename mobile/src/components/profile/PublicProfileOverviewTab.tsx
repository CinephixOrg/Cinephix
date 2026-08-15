import { useMemo } from "react";
import ContentRail from "../ContentRail";
import ContentCard from "../ContentCard";
import type { Favorites } from "../../types";
import { useTranslation } from "react-i18next";

const RAIL_CARD_WIDTH = 110;
const RAIL_HEIGHT = 250;

interface Props {
  favorites: Favorites | null;
  userId: string;
}

// Read-only counterpart to ProfileOverviewTab (own profile) — that component
// fetches YOUR watchlist/to-watch/activity feed and lets you edit favorites,
// none of which are safe or even backend-supported for someone else's
// profile (getWatchlist/getToWatchList/getFeed are always current-user-
// scoped, there's no userId param). This only shows what the backend
// actually exposes for another user: their favorite movies/series, exactly
// as the public profile page already displayed before it grew tabs.
export default function PublicProfileOverviewTab({ favorites, userId }: Props) {
  const { t } = useTranslation();
  const movies = useMemo(() => (favorites?.isAuthorized ? favorites.movies : []), [favorites]);
  const series = useMemo(() => (favorites?.isAuthorized ? favorites.series : []), [favorites]);

  if (!favorites?.isAuthorized) return null;

  return (
    <>
      <ContentRail
        title={t("Favorite Movies")}
        data={movies}
        keyExtractor={(m) => m._id}
        emptyText={t("No favorite movies yet.")}
        height={RAIL_HEIGHT}
        renderItem={(m) => (
          <ContentCard
            id={m._id}
            type="movie"
            title={m.title}
            posterPath={m.poster_path}
            basePath={`/user/${userId}`}
            style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
          />
        )}
      />
      <ContentRail
        title={t("Favorite Series")}
        data={series}
        keyExtractor={(s) => s._id}
        emptyText={t("No favorite series yet.")}
        height={RAIL_HEIGHT}
        renderItem={(s) => (
          <ContentCard
            id={s._id}
            type="series"
            title={s.name}
            posterPath={s.poster_path}
            basePath={`/user/${userId}`}
            style={{ width: RAIL_CARD_WIDTH, marginRight: 12, marginBottom: 0 }}
          />
        )}
      />
    </>
  );
}
