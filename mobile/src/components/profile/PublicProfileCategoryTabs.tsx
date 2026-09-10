import { useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ContentRail from "../ContentRail";
import FavoriteCard from "./FavoriteCard";
import ProfileSharingsTab from "./ProfileSharingsTab";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import SyncScoreCard from "./SyncScoreCard";
import PublicListsTab from "./PublicListsTab";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import type { CineGraphData, Favorites, Share, UserCollections } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";

export type Category = "sharings" | "favorites" | "lists" | "cinegraph";

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
  // Shares fetched with the rest of the profile bundle, so the default tab
  // renders content immediately rather than firing a second request and
  // sitting on a spinner after the profile itself already loaded.
  initialShares?: Share[];
  // Lists / watched list / watchlist, same deal.
  collections?: UserCollections;
}

// Declaration order is tab order, left to right.
const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  sharings: { active: "grid", inactive: "grid-outline" },
  favorites: { active: "heart", inactive: "heart-outline" },
  lists: { active: "list", inactive: "list-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
};

// Public-profile counterpart to ProfileCategoryTabs.tsx — same Sharings/
// Favorites/CineGraph 3 tabs as the own-profile version, minus Analyses
// (no public equivalent of WatchedList/Lists/Analyses/Activity — all
// current-user-scoped or backend-unsupported for an arbitrary userId).
// CineMatch/Analyze used to be standalone buttons above these tabs; now
// they live as SyncScoreCard at the top of the CineGraph tab
// body instead, since that's the only place a compatibility score is
// actually relevant.
export default function PublicProfileCategoryTabs({ favorites, cineGraph, userId, initialCategory, initialShares, collections }: Props) {
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
        hiddenTab: { display: "none" },
      }),
    [colors]
  );

  const [category, setCategory] = useState<Category>(initialCategory || "sharings");
  const [cinegraphSubTab, setCinegraphSubTab] = useState<CineGraphSubTab>("movie");

  // Same keep-alive as the own-profile tabs: a visited tab stays mounted and
  // is merely hidden. Without it, every trip back to CineGraph remounted the
  // donut (recomputing its slice geometry and re-measuring 19 chips) and
  // re-ran this profile's match request from scratch. Tracked in a ref and
  // written during render so the tab exists on the same pass that selects
  // it; adding to a Set is idempotent, so a double render is harmless.
  const visitedRef = useRef<Set<Category>>(new Set());
  visitedRef.current.add(category);
  const hasVisited = (key: Category) => visitedRef.current.has(key);
  const visibility = (key: Category) => (category === key ? undefined : styles.hiddenTab);

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

      {hasVisited("cinegraph") && cineGraph?.isAuthorized && (
        <View style={visibility("cinegraph")}>
          <SyncScoreCard userId={userId} />
          <View style={styles.subFilterRow}>
            <CineGraphSubTabSwitcher activeTab={cinegraphSubTab} onChange={setCinegraphSubTab} />
          </View>
        </View>
      )}

      <View style={styles.body}>
        {hasVisited("sharings") && (
          <View style={visibility("sharings")}>
            <ProfileSharingsTab
              userId={userId}
              basePath={`/user/${userId}`}
              active={category === "sharings"}
              initialShares={initialShares}
            />
          </View>
        )}

        {hasVisited("favorites") && favorites?.isAuthorized && (
          <View style={visibility("favorites")}>
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
          </View>
        )}

        {hasVisited("lists") && (
          <View style={visibility("lists")}>
            <PublicListsTab collections={collections} userId={userId} />
          </View>
        )}

        {hasVisited("cinegraph") && (
          <View style={visibility("cinegraph")}>
            <ProfileCinegraphsTab cineGraph={cineGraph} subTab={cinegraphSubTab} basePath={`/user/${userId}`} />
          </View>
        )}
      </View>
    </>
  );
}
