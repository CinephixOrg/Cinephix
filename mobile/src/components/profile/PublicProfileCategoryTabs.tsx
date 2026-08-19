import { useMemo, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ContentRail from "../ContentRail";
import ContentCard from "../ContentCard";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import type { CineGraphData, Favorites } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";

type Category = "favorites" | "cinegraph";

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
}

const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  favorites: { active: "heart", inactive: "heart-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
};

// Public-profile counterpart to ProfileCategoryTabs.tsx — only 2 icons since
// there's no public equivalent of WatchedList/Watchlist/Lists/Analyses/
// Activity (all current-user-scoped or backend-unsupported for a userId).
export default function PublicProfileCategoryTabs({ favorites, cineGraph, userId }: Props) {
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

  const [category, setCategory] = useState<Category>("favorites");
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
        <View style={styles.subFilterRow}>
          <CineGraphSubTabSwitcher activeTab={cinegraphSubTab} onChange={setCinegraphSubTab} />
        </View>
      )}

      <View style={styles.body}>
        {category === "favorites" && favorites?.isAuthorized && (
          <>
            <ContentRail
              title={t("Favorite Movies")}
              data={movies}
              keyExtractor={(m) => m._id}
              emptyText={t("No favorite movies yet.")}
              height={favoritesRailHeight}
              renderItem={(m, index) => (
                <ContentCard
                  id={m._id}
                  type="movie"
                  title={m.title}
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
                <ContentCard
                  id={s._id}
                  type="series"
                  title={s.name}
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
