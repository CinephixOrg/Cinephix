import { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import CineGraphDonut from "../CineGraphDonut";
import type { CineGraphData } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

type SubTab = "movie" | "series";

interface Props {
  cineGraph: CineGraphData | null;
  subTab: SubTab;
  // Which stack the genre-detail push should land in. The public profile
  // passes its own `/user/<id>`, so that page comes back to the profile it
  // was opened from (and reads that person's titles) instead of jumping
  // into the Profile tab's copy, which had no route back here at all.
  basePath?: "/profile" | `/user/${string}`;
}

// Movies/Series selection now lives one level up, as the capsule switcher
// anchored under the CineGraph tab icon (ProfileCategoryTabs.tsx's
// CineGraphSubTabSwitcher) — this component is a pure controlled display
// of whichever subTab the parent hands it, no tab UI of its own anymore.
function ProfileCinegraphsTab({ cineGraph, subTab, basePath = "/profile" }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        intro: { paddingHorizontal: 16, paddingTop: 12 },
        introLine: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, textAlign: "center", lineHeight: 18 },
      }),
    [colors]
  );

  if (!cineGraph) return null;

  return (
    <>
      <View style={styles.intro}>
        <Text style={styles.introLine}>{t("Your CineGraph shows what genres you watch the most.")}</Text>
        <Text style={styles.introLine}>{t("Tap on a genre to see its details.")}</Text>
      </View>

      {subTab === "movie" ? (
        <CineGraphDonut
          type="movie"
          stats={cineGraph.movieStats}
          genreRatings={cineGraph.movieGenreRatings}
          onDetailPress={(genre) => router.push(`${basePath}/genre/movie/${encodeURIComponent(genre)}` as any)}
        />
      ) : (
        <CineGraphDonut
          type="series"
          stats={cineGraph.seriesStats}
          genreRatings={cineGraph.seriesGenreRatings}
          onDetailPress={(genre) => router.push(`${basePath}/genre/series/${encodeURIComponent(genre)}` as any)}
        />
      )}
    </>
  );
}

// Memoized because this tab now stays mounted once visited (see
// ProfileCategoryTabs), so it would otherwise re-render — and re-run all of
// CineGraphDonut's slice/chip geometry — every time anything else on the
// profile screen changed. Both props are identity-stable: ProfileContext
// preserves the cineGraph object across revalidations that come back
// unchanged, and subTab only moves when the user taps the switcher.
export default memo(ProfileCinegraphsTab);
