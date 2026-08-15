import { useTranslation } from "react-i18next";
import CineGraphDonut from "../CineGraphDonut";
import type { CineGraphData } from "../../types";

interface Props {
  cineGraph: CineGraphData | null;
}

export default function ProfileCinegraphsTab({ cineGraph }: Props) {
  const { t } = useTranslation();

  // isAuthorized is always true for your own profile (the caller) — this
  // guard only matters when this component is reused for someone else's
  // profile, where a private account's graph comes back masked.
  if (!cineGraph || !cineGraph.isAuthorized) return null;

  return (
    <>
      <CineGraphDonut title={t("Watched Movie Genres")} stats={cineGraph.movieStats} />
      <CineGraphDonut title={t("Watched Series Genres")} stats={cineGraph.seriesStats} />
    </>
  );
}
