import { useMemo } from "react";
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
}

// Movies/Series selection now lives one level up, as the capsule switcher
// anchored under the CineGraph tab icon (ProfileCategoryTabs.tsx's
// CineGraphSubTabSwitcher) — this component is a pure controlled display
// of whichever subTab the parent hands it, no tab UI of its own anymore.
export default function ProfileCinegraphsTab({ cineGraph, subTab }: Props) {
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

  // isAuthorized is always true for your own profile (the caller) — this
  // guard only matters when this component is reused for someone else's
  // profile, where a private account's graph comes back masked.
  if (!cineGraph || !cineGraph.isAuthorized) return null;

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
          onDetailPress={(genre) => router.push(`/profile/genre/movie/${encodeURIComponent(genre)}` as any)}
        />
      ) : (
        <CineGraphDonut
          type="series"
          stats={cineGraph.seriesStats}
          genreRatings={cineGraph.seriesGenreRatings}
          onDetailPress={(genre) => router.push(`/profile/genre/series/${encodeURIComponent(genre)}` as any)}
        />
      )}
    </>
  );
}
