import { useMemo, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ContentRail from "../ContentRail";
import FavoriteCard from "./FavoriteCard";
import ProfileSharingsTab from "./ProfileSharingsTab";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import CineGraphCompatibilityCard from "./CineGraphCompatibilityCard";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import type { CineGraphData, Favorites } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";

export type Category = "sharings" | "favorites" | "cinegraph";

// Favorites are backend-capped at 5 (updateFavorites rejects >5) — sizing
// cards to fit exactly 5 across means the rail never needs to scroll, not
// just "usually doesn't."
const FAVORITES_COLUMNS = 5;
const FAVORITES_GAP = 8;
const FAVORITES_PADDING = 16; // matches ContentRail's own fixed railContent padding

interface Props {
  favorites: Favorites | null;
  cineGraph: CineGraphData | null;
  userId: string;
  // Lets a deep link (e.g. a "favorited" activity row) land straight on a
  // specific tab instead of always defaulting to Sharings.
  initialCategory?: Category;
}

const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  sharings: { active: "grid", inactive: "grid-outline" },
  favorites: { active: "heart", inactive: "heart-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
};

// Public-profile counterpart to ProfileCategoryTabs.tsx — same Sharings/
// Favorites/CineGraph 3 tabs as the own-profile version, minus Analyses
// (no public equivalent of WatchedList/Lists/Analyses/Activity — all
// current-user-scoped or backend-unsupported for an arbitrary userId).
// CineMatch/Analyze used to be standalone buttons above these tabs; now
// they live as CineGraphCompatibilityCard at the top of the CineGraph tab
// body instead, since that's the only place a compatibility score is
// actually relevant.
export default function PublicProfileCategoryTabs({ favorites, cineGraph, userId, initialCategory }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const favoritesCardWidth = (screenWidth - FAVORITES_PADDING * 2 - FAVORITES_GAP * (FAVORITES_COLUMNS - 1)) / FAVORITES_COLUMNS;
  const favoritesRailHeight = Math.round(favoritesCardWidth * 1.5) + 60;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabRow: {
          flexDirection: "row",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          marginTop: 16,
        },
        tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
        subFilterRow: { alignItems: "center", paddingTop: 8 },
        body: { paddingTop: 8 },
      }),
    [colors]
  );

  const [category, setCategory] = useState<Category>(initialCategory || "sharings");
  const [cinegraphSubTab, setCinegraphSubTab] = useState<CineGraphSubTab>("movie");

  const movies = favorites?.isAuthorized ? favorites.movies : [];
  const series = favorites?.isAuthorized ? favorites.series : [];

  return (
    <>
      <View style={styles.tabRow}>
        {(Object.keys(CATEGORY_ICON) as Category[]).map((key) => {
          const isActive = category === key;
          const icon = CATEGORY_ICON[key];
          return (
            <Pressable key={key} style={styles.tabButton} onPress={() => setCategory(key)}>
              <Ionicons
                name={isActive ? icon.active : icon.inactive}
                size={24}
                color={isActive ? colors.baseContent : colors.placeholder}
              />
            </Pressable>
          );
        })}
      </View>

      {category === "cinegraph" && cineGraph?.isAuthorized && (
        <>
          <CineGraphCompatibilityCard userId={userId} />
          <View style={styles.subFilterRow}>
            <CineGraphSubTabSwitcher activeTab={cinegraphSubTab} onChange={setCinegraphSubTab} />
          </View>
        </>
      )}

      <View style={styles.body}>
        {category === "sharings" && <ProfileSharingsTab userId={userId} basePath={`/user/${userId}`} />}

        {category === "favorites" && favorites?.isAuthorized && (
          <>
            <ContentRail
              title={t("Favorite Movies")}
              data={movies}
              keyExtractor={(m) => m._id}
              emptyText={t("No favorite movies yet.")}
              height={favoritesRailHeight}
              renderItem={(m, index) => (
                <FavoriteCard
                  id={m._id}
                  type="movie"
                  rating={m.rating}
                  posterPath={m.poster_path}
                  basePath={`/user/${userId}`}
                  style={{
                    width: favoritesCardWidth,
                    marginRight: index === movies.length - 1 ? 0 : FAVORITES_GAP,
                    marginBottom: 0,
                  }}
                />
              )}
            />
            <ContentRail
              title={t("Favorite Series")}
              data={series}
              keyExtractor={(s) => s._id}
              emptyText={t("No favorite series yet.")}
              height={favoritesRailHeight}
              renderItem={(s, index) => (
                <FavoriteCard
                  id={s._id}
                  type="series"
                  rating={s.rating}
                  posterPath={s.poster_path}
                  basePath={`/user/${userId}`}
                  style={{
                    width: favoritesCardWidth,
                    marginRight: index === series.length - 1 ? 0 : FAVORITES_GAP,
                    marginBottom: 0,
                  }}
                />
              )}
            />
          </>
        )}

        {category === "cinegraph" && <ProfileCinegraphsTab cineGraph={cineGraph} subTab={cinegraphSubTab} />}
      </View>
    </>
  );
}
