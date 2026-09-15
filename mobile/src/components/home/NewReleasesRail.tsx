import { useEffect, useState } from "react";
import { getNewReleases, type NewReleaseItem } from "../../api/feedService";
import ContentRail from "../ContentRail";
import MiniContentCard from "../MiniContentCard";
import { useTranslation } from "react-i18next";

const RAIL_COUNT = 20;
const CARD_WIDTH = 100;
const CARD_GAP = 10;

interface Props {
  basePath: "/lists" | "/home" | "/search" | "/profile" | "/watchlist" | "/to-watch";
}

// Real release_date/first_air_date within the last 90 days
// (feedController.js's getNewReleases), newest first — a plain catalog
// browse, not a recommendation, so nothing here is excluded for being
// already watched/queued the way WhatToWatchRail.tsx's own rail is.
// Same poster-only MiniContentCard treatment as that rail, direct ask to
// keep Discover's rails visually consistent with each other.
export default function NewReleasesRail({ basePath }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<NewReleaseItem[]>([]);

  useEffect(() => {
    getNewReleases(RAIL_COUNT)
      .then((res) => setItems(res.items))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <ContentRail
      title={t("New Releases")}
      data={items}
      keyExtractor={(item) => `${item.contentType}-${item._id}`}
      emptyText={t("Nothing new released recently.")}
      renderItem={(item) => (
        <MiniContentCard
          id={item._id}
          type={item.contentType}
          posterPath={item.poster_path}
          basePath={basePath}
          style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}
        />
      )}
    />
  );
}
