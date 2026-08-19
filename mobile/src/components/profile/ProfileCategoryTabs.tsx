import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ContentRail from "../ContentRail";
import ContentCard from "../ContentCard";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import ProfileAnalysesTab from "./ProfileAnalysesTab";
import ProfileSharingsTab from "./ProfileSharingsTab";
import ProfileAnalysisModal from "../ProfileAnalysisModal";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import EditFavoritesModal, { type FavoritePickItem } from "./EditFavoritesModal";
import type { CineGraphData, ContentType, Favorites, ProfileAnalysis } from "../../types";
import { useTheme } from "../../context/ThemeContext";

type Category = "sharings" | "favorites" | "cinegraph" | "analyses";

// Favorites are backend-capped at 5 (updateFavorites rejects >5) — sizing
// cards to fit exactly 5 across means the rail never needs to scroll, not
// just "usually doesn't."
const FAVORITES_COLUMNS = 5;
const FAVORITES_GAP = 8;
const FAVORITES_PADDING = 16; // matches ContentRail's own fixed railContent padding

interface Props {
  favorites: Favorites | null;
  cineGraph: CineGraphData | null;
}

const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  sharings: { active: "grid", inactive: "grid-outline" },
  favorites: { active: "heart", inactive: "heart-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
  analyses: { active: "document-text", inactive: "document-text-outline" },
};

export default function ProfileCategoryTabs({ favorites, cineGraph }: Props) {
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
        // Centered under the whole category row, not tied to the CineGraph
        // icon's own column — movie/series only, icon stays plain.
        subFilterRow: { alignItems: "center", paddingTop: 8 },
        body: { paddingTop: 8 },
      }),
    [colors]
  );

  const [category, setCategory] = useState<Category>("sharings");
  const [cinegraphSubTab, setCinegraphSubTab] = useState<CineGraphSubTab>("movie");

  const [localFavorites, setLocalFavorites] = useState(favorites);
  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);
  const [editingType, setEditingType] = useState<ContentType | null>(null);

  const handleFavoritesSaved = (type: ContentType, items: FavoritePickItem[]) => {
    setLocalFavorites((prev) => {
      const prevMovies = prev?.isAuthorized ? prev.movies : [];
      const prevSeries = prev?.isAuthorized ? prev.series : [];
      return {
        isAuthorized: true,
        movies:
          type === "movie"
            ? items.map((i) => ({ _id: i._id, title: i.label, poster_path: i.poster_path }))
            : prevMovies,
        series:
          type === "series"
            ? items.map((i) => ({ _id: i._id, name: i.label, poster_path: i.poster_path }))
            : prevSeries,
      };
    });
  };

  const [analysisData, setAnalysisData] = useState<ProfileAnalysis | null>(null);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);

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
        {category === "sharings" && <ProfileSharingsTab />}

        {category === "favorites" && localFavorites && (
          <>
            <ContentRail
              title={t("Favorite Movies")}
              data={localFavorites.movies}
              keyExtractor={(m) => m._id}
              emptyText={t("No favorite movies yet.")}
              height={favoritesRailHeight}
              onEditPress={() => setEditingType("movie")}
              editLabel={t("Edit Favorite Movies")}
              renderItem={(m, index) => (
                <ContentCard
                  id={m._id}
                  type="movie"
                  title={m.title}
                  posterPath={m.poster_path}
                  basePath="/profile"
                  style={{
                    width: favoritesCardWidth,
                    marginRight: index === localFavorites.movies.length - 1 ? 0 : FAVORITES_GAP,
                    marginBottom: 0,
                  }}
                />
              )}
            />
            <ContentRail
              title={t("Favorite Series")}
              data={localFavorites.series}
              keyExtractor={(s) => s._id}
              emptyText={t("No favorite series yet.")}
              height={favoritesRailHeight}
              onEditPress={() => setEditingType("series")}
              editLabel={t("Edit Favorite Series")}
              renderItem={(s, index) => (
                <ContentCard
                  id={s._id}
                  type="series"
                  title={s.name}
                  posterPath={s.poster_path}
                  basePath="/profile"
                  style={{
                    width: favoritesCardWidth,
                    marginRight: index === localFavorites.series.length - 1 ? 0 : FAVORITES_GAP,
                    marginBottom: 0,
                  }}
                />
              )}
            />
          </>
        )}

        {category === "cinegraph" && <ProfileCinegraphsTab cineGraph={cineGraph} subTab={cinegraphSubTab} />}

        {category === "analyses" && (
          <ProfileAnalysesTab
            onViewAnalysis={(data) => {
              setAnalysisData(data);
              setAnalysisModalVisible(true);
            }}
          />
        )}
      </View>

      <EditFavoritesModal
        visible={editingType !== null}
        type={editingType ?? "movie"}
        favorites={editingType === "series" ? localFavorites?.series ?? [] : localFavorites?.movies ?? []}
        onClose={() => setEditingType(null)}
        onSaved={handleFavoritesSaved}
      />

      <ProfileAnalysisModal
        visible={analysisModalVisible}
        onClose={() => setAnalysisModalVisible(false)}
        data={analysisData}
        shareable
      />
    </>
  );
}
