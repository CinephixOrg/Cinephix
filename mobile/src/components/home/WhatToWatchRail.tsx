import { useEffect, useState } from "react";
import { getRecommendations, type RecommendationItem } from "../../api/feedService";
import ContentRail from "../ContentRail";
import MiniContentCard from "../MiniContentCard";
import { useTranslation } from "react-i18next";

const RAIL_COUNT = 20;
const CARD_WIDTH = 100;
const CARD_GAP = 10;

interface Props {
  basePath: "/lists" | "/home" | "/search" | "/profile" | "/watchlist" | "/to-watch";
}

// Discover's newest section, last in the page order per direct ask — a
// genre-affinity pick off the viewer's own CineGraph (feedController.js's
// getRecommendations, already built server-side, just never had a mobile
// call site until now), excluding anything already watched/queued. Falls
// back to a generic popular set server-side when the viewer has no rating
// history yet to build a genre profile from (hasPersonalization:false) —
// same rail either way, no separate empty/cold-start UI needed here.
export default function WhatToWatchRail({ basePath }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    getRecommendations(RAIL_COUNT)
      .then((res) => setItems(res.recommendations))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <ContentRail
      title={t("What to Watch")}
      data={items}
      keyExtractor={(item) => `${item.contentType}-${item._id}`}
      emptyText={t("Nothing to recommend yet.")}
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
