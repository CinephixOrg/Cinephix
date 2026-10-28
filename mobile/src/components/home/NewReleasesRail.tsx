import { useEffect, useState } from "react";
import { getNewReleases, type NewReleaseItem } from "../../api/feedService";
import ContentRail from "../ContentRail";
import MiniContentCard from "../MiniContentCard";
import ContentTypeToggle from "../common/ContentTypeToggle";
import { useTranslation } from "react-i18next";
import type { ContentType } from "../../types";

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
//
// Movies or series, one at a time (FB-14), switched with the same toggle as
// the podium above it — movies first, as there.
export default function NewReleasesRail({ basePath }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ContentType>("movie");
  const [items, setItems] = useState<NewReleaseItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The other list stays up until this one arrives, so switching doesn't
    // empty the rail (and shift the page) in between.
    getNewReleases(RAIL_COUNT, mode)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (!loaded) return null;

  return (
    <ContentRail
      title={t("New Releases")}
      titleAccessory={<ContentTypeToggle value={mode} onChange={setMode} />}
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
