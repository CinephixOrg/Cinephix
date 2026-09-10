import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ContentRail from "../ContentRail";
import FavoriteCard from "./FavoriteCard";
import EmptyFavoriteSlot from "./EmptyFavoriteSlot";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import ProfileAnalysesTab from "./ProfileAnalysesTab";
import ProfileSharingsTab from "./ProfileSharingsTab";
import ProfileAnalysisModal from "../ProfileAnalysisModal";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import AddFavoriteModal, { type FavoritePickItem } from "./AddFavoriteModal";
import { updateFavorites } from "../../api/favoriteService";
import type { CineGraphData, ContentType, Favorites, ProfileAnalysis } from "../../types";
import { useTheme } from "../../context/ThemeContext";

export type Category = "sharings" | "favorites" | "cinegraph" | "analyses";

// Favorites are backend-capped at 5 (updateFavorites rejects >5) — sizing
// cards to fit exactly 5 across means the rail never needs to scroll, not
// just "usually doesn't."
const FAVORITES_COLUMNS = 5;
const FAVORITES_GAP = 8;
const FAVORITES_PADDING = 16; // matches ContentRail's own fixed railContent padding
const FAVORITES_MAX = 5;

// FavoriteCard doesn't care whether it's rendering a movie or series (it
// never shows the title, just the poster + rating), so both favorite item
// shapes collapse to this for rendering purposes. A rail padded up to
// FAVORITES_MAX with "empty" slots (only while that rail is in edit mode)
// is what lets EmptyFavoriteSlot's "+" tiles appear in the free spaces.
type FavItem = { _id: string; poster_path?: string | null; rating?: number | null };
type FavSlot = { kind: "item"; item: FavItem } | { kind: "empty"; key: string };

function buildSlots(items: FavItem[], editing: boolean): FavSlot[] {
  const itemSlots: FavSlot[] = items.map((item) => ({ kind: "item", item }));
  if (!editing) return itemSlots;
  const emptyCount = Math.max(0, FAVORITES_MAX - items.length);
  const emptySlots: FavSlot[] = Array.from({ length: emptyCount }, (_, i) => ({ kind: "empty", key: `empty-${i}` }));
  return [...itemSlots, ...emptySlots];
}

interface Props {
  favorites: Favorites | null;
  cineGraph: CineGraphData | null;
  // Lets a deep link (e.g. an official-account tip's own linked word) land
  // straight on a specific tab instead of always defaulting to Sharings —
  // same prop/pattern PublicProfileCategoryTabs.tsx's own initialCategory
  // already established for the public-profile equivalent.
  initialCategory?: Category;
}

const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  sharings: { active: "grid", inactive: "grid-outline" },
  favorites: { active: "heart", inactive: "heart-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
  analyses: { active: "document-text", inactive: "document-text-outline" },
};

export default function ProfileCategoryTabs({ favorites, cineGraph, initialCategory }: Props) {
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

  const [category, setCategory] = useState<Category>(initialCategory || "sharings");
  const [cinegraphSubTab, setCinegraphSubTab] = useState<CineGraphSubTab>("movie");

  const [localFavorites, setLocalFavorites] = useState(favorites);
  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);
  // Which rail (if either) is showing the inline remove-overlay/add-slot
  // edit mode — toggled by that rail's own pencil icon, replacing the old
  // "open a full-screen edit modal" flow.
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [addingType, setAddingType] = useState<ContentType | null>(null);

  const toggleEditing = (type: ContentType) => setEditingType((prev) => (prev === type ? null : type));

  // Removal is immediate (no separate Save step) — the X on an overlaid
  // card acts the same way a delete button would anywhere else in the app.
  // Optimistic locally, reverted if the API call fails.
  const handleRemoveFavorite = async (type: ContentType, id: string) => {
    if (!localFavorites?.isAuthorized) return;
    const applyList = (cur: Favorites | null, movies: typeof localFavorites.movies, series: typeof localFavorites.series) =>
      cur?.isAuthorized ? { ...cur, movies, series } : cur;

    if (type === "movie") {
      const prevList = localFavorites.movies;
      const nextList = prevList.filter((i) => i._id !== id);
      setLocalFavorites((cur) => applyList(cur, nextList, cur?.isAuthorized ? cur.series : []));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => applyList(cur, prevList, cur?.isAuthorized ? cur.series : []));
      }
    } else {
      const prevList = localFavorites.series;
      const nextList = prevList.filter((i) => i._id !== id);
      setLocalFavorites((cur) => applyList(cur, cur?.isAuthorized ? cur.movies : [], nextList));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => applyList(cur, cur?.isAuthorized ? cur.movies : [], prevList));
      }
    }
  };

  // Optimistic, same as handleRemoveFavorite — was previously re-fetching
  // via getFavorites("me") afterward instead, but GET /users/favorites/:id
  // never actually supported "me" as an id alias (unlike the shares
  // endpoint, which does special-case it), so that call silently 404'd,
  // landed in the catch, and the new item never appeared until the next
  // unrelated refetch (e.g. leaving and returning to the tab). rating is
  // left null here (a freshly-added item won't show its previous rating,
  // if any, until the next natural refresh) — an acceptable gap in
  // exchange for the add actually being instant and not depending on a
  // second network round trip.
  const handleAddFavorite = async (type: ContentType, item: FavoritePickItem) => {
    if (!localFavorites?.isAuthorized) return;
    const applyList = (cur: Favorites | null, movies: typeof localFavorites.movies, series: typeof localFavorites.series) =>
      cur?.isAuthorized ? { ...cur, movies, series } : cur;

    // Picking a result from the search modal concludes the edit session —
    // edit mode (the red remove-overlay/empty-"+"-slot UI) turns back off
    // immediately rather than staying on indefinitely; a subsequent edit
    // needs a fresh tap on the pencil, same as arriving at the tab fresh.
    setEditingType(null);

    if (type === "movie") {
      const prevList = localFavorites.movies;
      const nextList = [...prevList, { _id: item._id, title: item.label, poster_path: item.poster_path, rating: null }];
      setLocalFavorites((cur) => applyList(cur, nextList, cur?.isAuthorized ? cur.series : []));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => applyList(cur, prevList, cur?.isAuthorized ? cur.series : []));
      }
    } else {
      const prevList = localFavorites.series;
      const nextList = [...prevList, { _id: item._id, name: item.label, poster_path: item.poster_path, rating: null }];
      setLocalFavorites((cur) => applyList(cur, cur?.isAuthorized ? cur.movies : [], nextList));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => applyList(cur, cur?.isAuthorized ? cur.movies : [], prevList));
      }
    }
  };

  // Memoized so AddFavoriteModal only sees a new array when the underlying
  // favorited ids actually change — an unmemoized inline .map() here was a
  // fresh reference on every render, which fed straight into that modal's
  // search effect as a dependency and caused spurious re-searches.
  const favoriteExcludeIds = useMemo(() => {
    const list = addingType === "series"
      ? (localFavorites?.isAuthorized && localFavorites.series) || []
      : (localFavorites?.isAuthorized && localFavorites.movies) || [];
    return list.map((i) => i._id);
  }, [addingType, localFavorites]);

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
            {(() => {
              const movieSlots = buildSlots(localFavorites.movies, editingType === "movie");
              return (
                <ContentRail
                  title={t("Favorite Movies")}
                  data={movieSlots}
                  keyExtractor={(slot) => (slot.kind === "item" ? slot.item._id : slot.key)}
                  emptyText={t("No favorite movies yet.")}
                  height={favoritesRailHeight}
                  onEditPress={() => toggleEditing("movie")}
                  editLabel={t("Edit Favorite Movies")}
                  renderItem={(slot, index) => {
                    const cardStyle = {
                      width: favoritesCardWidth,
                      marginRight: index === movieSlots.length - 1 ? 0 : FAVORITES_GAP,
                      marginBottom: 0,
                    };
                    return slot.kind === "item" ? (
                      <FavoriteCard
                        id={slot.item._id}
                        type="movie"
                        posterPath={slot.item.poster_path}
                        rating={slot.item.rating}
                        basePath="/profile"
                        editing={editingType === "movie"}
                        onRemove={() => handleRemoveFavorite("movie", slot.item._id)}
                        style={cardStyle}
                      />
                    ) : (
                      <EmptyFavoriteSlot onPress={() => setAddingType("movie")} style={cardStyle} />
                    );
                  }}
                />
              );
            })()}
            {(() => {
              const seriesSlots = buildSlots(localFavorites.series, editingType === "series");
              return (
                <ContentRail
                  title={t("Favorite Series")}
                  data={seriesSlots}
                  keyExtractor={(slot) => (slot.kind === "item" ? slot.item._id : slot.key)}
                  emptyText={t("No favorite series yet.")}
                  height={favoritesRailHeight}
                  onEditPress={() => toggleEditing("series")}
                  editLabel={t("Edit Favorite Series")}
                  renderItem={(slot, index) => {
                    const cardStyle = {
                      width: favoritesCardWidth,
                      marginRight: index === seriesSlots.length - 1 ? 0 : FAVORITES_GAP,
                      marginBottom: 0,
                    };
                    return slot.kind === "item" ? (
                      <FavoriteCard
                        id={slot.item._id}
                        type="series"
                        posterPath={slot.item.poster_path}
                        rating={slot.item.rating}
                        basePath="/profile"
                        editing={editingType === "series"}
                        onRemove={() => handleRemoveFavorite("series", slot.item._id)}
                        style={cardStyle}
                      />
                    ) : (
                      <EmptyFavoriteSlot onPress={() => setAddingType("series")} style={cardStyle} />
                    );
                  }}
                />
              );
            })()}
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

      <AddFavoriteModal
        visible={addingType !== null}
        type={addingType ?? "movie"}
        excludeIds={favoriteExcludeIds}
        onClose={() => setAddingType(null)}
        onAdd={(item) => addingType && handleAddFavorite(addingType, item)}
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
