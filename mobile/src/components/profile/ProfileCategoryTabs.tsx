import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ContentRail from "../ContentRail";
import FavoriteCard from "./FavoriteCard";
import EmptyFavoriteSlot from "./EmptyFavoriteSlot";
import ProfileCinegraphsTab from "./ProfileCinegraphsTab";
import ProfileAnalysesTab from "./ProfileAnalysesTab";
import ProfileBadgesTab from "./ProfileBadgesTab";
import ProfileSharingsTab from "./ProfileSharingsTab";
import ProfileAnalysisModal from "../ProfileAnalysisModal";
import CineGraphSubTabSwitcher, { type CineGraphSubTab } from "./CineGraphSubTabSwitcher";
import AddFavoriteModal, { type FavoritePickItem } from "./AddFavoriteModal";
import CollectionUndoBar from "../collection/CollectionUndoBar";
import { updateFavorites } from "../../api/favoriteService";
import type { CineGraphData, ContentType, Favorites, ProfileAnalysis } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";

export type Category = "sharings" | "favorites" | "cinegraph" | "analyses" | "badges";

// Favorites are backend-capped at 5 (updateFavorites rejects >5) — sizing
// cards to fit exactly 5 across means the rail never needs to scroll, not
// just "usually doesn't."
const FAVORITES_COLUMNS = 5;
const FAVORITES_GAP = 8;
const FAVORITES_PADDING = 16; // matches ContentRail's own fixed railContent padding
const FAVORITES_MAX = 5;
const REMOVE_UNDO_MS = 4000;

// FavoriteCard doesn't care whether it's rendering a movie or series (it
// never shows the title, just the poster + rating), so both favorite item
// shapes collapse to this for rendering purposes.
type FavItem = { _id: string; poster_path?: string | null; rating?: number | null };

// The empty "+" slots only ever trail the real items (never interspersed),
// so they're rendered as ContentRail's own fixed `footer` now instead of
// being padded into `data` as their own FavSlot union — that union existed
// specifically to let this rail's data double as both real items AND empty
// slots in one array, which stopped working once real items also needed to
// be individually drag-reordered (an empty slot has nothing to reorder).
function emptySlotKeys(items: FavItem[], editing: boolean): string[] {
  if (!editing) return [];
  const emptyCount = Math.max(0, FAVORITES_MAX - items.length);
  return Array.from({ length: emptyCount }, (_, i) => `empty-${i}`);
}

interface Props {
  favorites: Favorites | null;
  cineGraph: CineGraphData | null;
  // Controlled from the parent (profile/index.tsx) so the header's Shares
  // stat can jump straight to the Sharings tab from outside this
  // component — the fade below still runs regardless of which of them
  // triggered the change, since it's keyed on the `category` value itself.
  // Deep-link seeding (e.g. an official-account tip's own linked word
  // landing on a specific tab) lives in the parent's own initial useState
  // value now instead of a separate initialCategory prop here — same end
  // result, just seeded one level up now that category is controlled.
  category: Category;
  onCategoryChange: (category: Category) => void;
  // Whether this whole screen currently has navigation focus — passed
  // through to AddFavoriteModal so it can hide (without resetting) while a
  // result's poster/title tap sends us to that title's Content Detail page,
  // then reappear with its search state intact once we come back.
  screenFocused: boolean;
  // Forwarded straight through to ProfileSharingsTab.tsx — see that
  // component's own comment, and profile/index.tsx's, for the full "why":
  // this screen's single outer ScrollView is the only thing that can
  // detect "near the bottom," but only the Sharings tab's own feed mode
  // ever needs to react to it.
  nearBottomRef?: React.MutableRefObject<(() => void) | null>;
}

const CATEGORY_ICON: Record<Category, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  sharings: { active: "grid", inactive: "grid-outline" },
  favorites: { active: "heart", inactive: "heart-outline" },
  cinegraph: { active: "pie-chart", inactive: "pie-chart-outline" },
  analyses: { active: "document-text", inactive: "document-text-outline" },
  badges: { active: "ribbon", inactive: "ribbon-outline" },
};

export default function ProfileCategoryTabs({ favorites, cineGraph, category, onCategoryChange, screenFocused, nearBottomRef }: Props) {
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
        hiddenTab: { display: "none" },
        // Between Favorite Movies and Favorite Series — direct ask, same
        // hairline+colors.border language used everywhere else in this app
        // (statsRowDivider and its many siblings), just not one this file
        // had a reason to need until now.
        favoritesDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: 16,
          marginBottom: 8,
        },
        emptySlotsRow: { flexDirection: "row", marginLeft: FAVORITES_GAP },
      }),
    [colors]
  );

  const [cinegraphSubTab, setCinegraphSubTab] = useState<CineGraphSubTab>("movie");

  // Which categories have ever been opened. Once a tab has been visited it
  // stays mounted and is merely hidden, instead of being unmounted and
  // rebuilt from nothing on the next visit.
  //
  // This is the fix for "CineGraph is slow and shows a loader every time":
  // conditional rendering meant each visit remounted CineGraphDonut, which
  // recomputes its slice geometry, re-derives 19 chip positions, and then
  // re-measures every one of those chips through onLayout before it can
  // settle. ProfileSharingsTab was worse — it refetched the user's shares
  // and showed a spinner on every single switch back to it.
  //
  // Written during render rather than in an effect so the tab is present on
  // the very same pass that selects it (an effect would leave one blank
  // frame). Adding to a Set is idempotent, so StrictMode's double render is
  // harmless here.
  const visitedRef = useRef<Set<Category>>(new Set());
  visitedRef.current.add(category);
  const hasVisited = (key: Category) => visitedRef.current.has(key);
  // `display: none` keeps the subtree mounted with all its state, timers and
  // fetched data intact, but takes it out of layout entirely — so hidden
  // tabs cost nothing to lay out or draw.
  const visibility = (key: Category) => (category === key ? undefined : styles.hiddenTab);

  // Fades the body in on every category change, regardless of whether it
  // came from tapping one of the icons below or from the header's Shares
  // stat (ProfileHeaderInstagram, a sibling rendered outside this
  // component) — keyed purely on the value so both sources look identical.
  // Skips the very first render so the initial "sharings" tab doesn't
  // fade in on mount.
  const bodyOpacity = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    bodyOpacity.setValue(0);
    Animated.timing(bodyOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [category, bodyOpacity]);

  const [localFavorites, setLocalFavorites] = useState(favorites);
  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);
  // Which rail (if either) is showing the inline remove-overlay/add-slot/
  // drag-to-reorder edit mode — toggled by that rail's own pencil icon,
  // replacing the old "open a full-screen edit modal" flow.
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [addingType, setAddingType] = useState<ContentType | null>(null);
  const { showToast } = useToast();

  // Removal — same optimistic-hide-then-commit-with-undo shape
  // CollectionScreen.tsx's own Watched List/Watchlist removal already uses
  // (a direct ask to bring here too): the X hides the card immediately,
  // but the actual updateFavorites call (and the loss of whatever rating
  // was attached — favoriting doesn't touch a rating, but removing the
  // FAVORITE ITSELF is exactly the kind of "large tap target, easy to
  // mis-tap" action that bar exists for) waits out REMOVE_UNDO_MS unless
  // undone. One pending removal at a time, same rule as the Watched List.
  const pendingRemovalRef = useRef<{ type: ContentType; item: FavItem; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [undoEntry, setUndoEntry] = useState<FavItem | null>(null);

  // `item` itself is unused here — the optimistic removal already happened
  // at hide-time in handleRemoveFavorite below, so committing just means
  // persisting whatever `localFavorites` already reflects. Kept as a
  // parameter for symmetry with flushPendingRemoval's own bookkeeping.
  const commitRemoval = useCallback(
    (type: ContentType) => {
      setLocalFavorites((cur) => {
        if (!cur) return cur;
        const key = type === "movie" ? "movies" : "series";
        const list = (cur as any)[key] as FavItem[];
        // A failed persist isn't rolled back here — same precedent
        // CollectionScreen.tsx's own commitRemoval sets (a toast, not a
        // silent revert) for this kind of rare-failure case.
        updateFavorites(type, list.map((i) => i._id)).catch(() => {
          showToast(t("Something went wrong. Please try again."));
        });
        return cur;
      });
    },
    [showToast, t]
  );

  const flushPendingRemoval = useCallback(() => {
    const pending = pendingRemovalRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRemovalRef.current = null;
    setUndoEntry(null);
    commitRemoval(pending.type);
  }, [commitRemoval]);

  useEffect(() => () => flushPendingRemoval(), [flushPendingRemoval]);

  const handleRemoveFavorite = useCallback(
    (type: ContentType, item: FavItem) => {
      if (!localFavorites) return;
      if (pendingRemovalRef.current?.item._id === item._id && pendingRemovalRef.current.type === type) return;
      flushPendingRemoval();

      const key = type === "movie" ? "movies" : "series";
      setLocalFavorites((cur) => (cur ? { ...cur, [key]: (cur as any)[key].filter((i: FavItem) => i._id !== item._id) } : cur));

      const timer = setTimeout(() => {
        if (pendingRemovalRef.current?.item !== item) return;
        pendingRemovalRef.current = null;
        setUndoEntry(null);
        commitRemoval(type);
      }, REMOVE_UNDO_MS);
      pendingRemovalRef.current = { type, item, timer };
      setUndoEntry(item);
    },
    [localFavorites, flushPendingRemoval, commitRemoval]
  );

  const handleUndoRemoveFavorite = useCallback(() => {
    const pending = pendingRemovalRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRemovalRef.current = null;
    setUndoEntry(null);
    const key = pending.type === "movie" ? "movies" : "series";
    setLocalFavorites((cur) => {
      if (!cur) return cur;
      const list = (cur as any)[key] as FavItem[];
      if (list.some((i) => i._id === pending.item._id)) return cur;
      return { ...cur, [key]: [...list, pending.item] };
    });
  }, []);

  // Toggling edit mode off commits any still-pending removal right away —
  // its undo window is scoped to being in edit mode, not left dangling
  // once the pencil's tapped back to "Done".
  const toggleEditing = (type: ContentType) => {
    if (editingType === type) flushPendingRemoval();
    setEditingType((prev) => (prev === type ? null : type));
  };

  // Auto-close edit mode on leaving this screen — real bug, reported live:
  // opening edit mode, switching to another tab/screen without tapping
  // "Done" first, then coming back to Profile left edit mode still on.
  // Same screenFocused signal ProfileBadgesTab.tsx's own revalidate effect
  // already uses for "did the user leave and come back" — commits any
  // still-pending removal first, same as tapping the pencil to close it
  // manually already does.
  useEffect(() => {
    if (screenFocused || !editingType) return;
    flushPendingRemoval();
    setEditingType(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenFocused]);

  // Drag-to-reorder (ContentRail's own dragEnabled/onReorder) — the new
  // order comes back as the full reordered array already, so this is a
  // straight optimistic-set-then-persist, no diffing needed.
  const handleReorderFavorite = useCallback(
    (type: ContentType, reordered: FavItem[]) => {
      if (!localFavorites) return;
      const key = type === "movie" ? "movies" : "series";
      const prevList = (localFavorites as any)[key] as FavItem[];
      setLocalFavorites((cur) => (cur ? { ...cur, [key]: reordered } : cur));
      updateFavorites(type, reordered.map((i) => i._id)).catch(() => {
        setLocalFavorites((cur) => (cur ? { ...cur, [key]: prevList } : cur));
        showToast(t("Something went wrong. Please try again."));
      });
    },
    [localFavorites, showToast, t]
  );

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
    if (!localFavorites) return;

    // Picking a result from the search modal concludes the edit session —
    // edit mode (the red remove-overlay/empty-"+"-slot UI) turns back off
    // immediately rather than staying on indefinitely; a subsequent edit
    // needs a fresh tap on the pencil, same as arriving at the tab fresh.
    setEditingType(null);

    if (type === "movie") {
      const prevList = localFavorites.movies;
      const nextList = [...prevList, { _id: item._id, title: item.label, poster_path: item.poster_path, rating: null }];
      setLocalFavorites((cur) => (cur ? { ...cur, movies: nextList } : cur));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => (cur ? { ...cur, movies: prevList } : cur));
      }
    } else {
      const prevList = localFavorites.series;
      const nextList = [...prevList, { _id: item._id, name: item.label, poster_path: item.poster_path, rating: null }];
      setLocalFavorites((cur) => (cur ? { ...cur, series: nextList } : cur));
      try {
        await updateFavorites(type, nextList.map((i) => i._id));
      } catch {
        setLocalFavorites((cur) => (cur ? { ...cur, series: prevList } : cur));
      }
    }
  };

  // Memoized so AddFavoriteModal only sees a new array when the underlying
  // favorited ids actually change — an unmemoized inline .map() here was a
  // fresh reference on every render, which fed straight into that modal's
  // search effect as a dependency and caused spurious re-searches.
  const favoriteExcludeIds = useMemo(() => {
    const list = (addingType === "series" ? localFavorites?.series : localFavorites?.movies) ?? [];
    return list.map((i) => i._id);
  }, [addingType, localFavorites]);

  const [analysisData, setAnalysisData] = useState<ProfileAnalysis | null>(null);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);

  // Stable identity: the Analyses tab now stays mounted, so an inline arrow
  // here would hand it a new prop on every render of this component.
  const handleViewAnalysis = useCallback((data: ProfileAnalysis) => {
    setAnalysisData(data);
    setAnalysisModalVisible(true);
  }, []);

  return (
    <>
      <View style={styles.tabRow}>
        {(Object.keys(CATEGORY_ICON) as Category[]).map((key) => {
          const isActive = category === key;
          const icon = CATEGORY_ICON[key];
          return (
            <Pressable key={key} style={styles.tabButton} onPress={() => onCategoryChange(key)}>
              <Ionicons
                name={isActive ? icon.active : icon.inactive}
                size={24}
                color={isActive ? colors.baseContent : colors.placeholder}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Kept mounted alongside the graph it belongs to — it measures its
          own slot widths via onLayout to drive the sliding window, and
          remounting made it re-measure and re-animate from scratch. */}
      {hasVisited("cinegraph") && cineGraph && (
        <View style={[styles.subFilterRow, visibility("cinegraph")]}>
          <CineGraphSubTabSwitcher activeTab={cinegraphSubTab} onChange={setCinegraphSubTab} />
        </View>
      )}

      <Animated.View style={[styles.body, { opacity: bodyOpacity }]}>
        {hasVisited("sharings") && (
          <View style={visibility("sharings")}>
            <ProfileSharingsTab active={category === "sharings"} nearBottomRef={nearBottomRef} />
          </View>
        )}

        {hasVisited("favorites") && localFavorites && (
          <View style={visibility("favorites")}>
            {(() => {
              const movies = localFavorites.movies;
              const movieEmptyKeys = emptySlotKeys(movies, editingType === "movie");
              return (
                <ContentRail
                  title={t("Favorite Movies")}
                  data={movies}
                  keyExtractor={(item) => item._id}
                  emptyText={t("No favorite movies yet.")}
                  height={favoritesRailHeight}
                  onEditPress={() => toggleEditing("movie")}
                  editLabel={t("Edit Favorite Movies")}
                  dragEnabled={editingType === "movie"}
                  onReorder={(reordered) => handleReorderFavorite("movie", reordered)}
                  footer={
                    movieEmptyKeys.length > 0 ? (
                      <View style={styles.emptySlotsRow}>
                        {movieEmptyKeys.map((key, i) => (
                          <EmptyFavoriteSlot
                            key={key}
                            onPress={() => setAddingType("movie")}
                            style={{ width: favoritesCardWidth, marginRight: i === movieEmptyKeys.length - 1 ? 0 : FAVORITES_GAP, marginBottom: 0 }}
                          />
                        ))}
                      </View>
                    ) : undefined
                  }
                  renderItem={(item, index, drag) => (
                    <FavoriteCard
                      id={item._id}
                      type="movie"
                      posterPath={item.poster_path}
                      rating={item.rating}
                      basePath="/profile"
                      editing={editingType === "movie"}
                      onRemove={() => handleRemoveFavorite("movie", item)}
                      drag={drag}
                      style={{
                        width: favoritesCardWidth,
                        marginRight: index === movies.length - 1 && movieEmptyKeys.length === 0 ? 0 : FAVORITES_GAP,
                        marginBottom: 0,
                      }}
                    />
                  )}
                />
              );
            })()}

            <View style={styles.favoritesDivider} />

            {(() => {
              const series = localFavorites.series;
              const seriesEmptyKeys = emptySlotKeys(series, editingType === "series");
              return (
                <ContentRail
                  title={t("Favorite Series")}
                  data={series}
                  keyExtractor={(item) => item._id}
                  emptyText={t("No favorite series yet.")}
                  height={favoritesRailHeight}
                  onEditPress={() => toggleEditing("series")}
                  editLabel={t("Edit Favorite Series")}
                  dragEnabled={editingType === "series"}
                  onReorder={(reordered) => handleReorderFavorite("series", reordered)}
                  footer={
                    seriesEmptyKeys.length > 0 ? (
                      <View style={styles.emptySlotsRow}>
                        {seriesEmptyKeys.map((key, i) => (
                          <EmptyFavoriteSlot
                            key={key}
                            onPress={() => setAddingType("series")}
                            style={{ width: favoritesCardWidth, marginRight: i === seriesEmptyKeys.length - 1 ? 0 : FAVORITES_GAP, marginBottom: 0 }}
                          />
                        ))}
                      </View>
                    ) : undefined
                  }
                  renderItem={(item, index, drag) => (
                    <FavoriteCard
                      id={item._id}
                      type="series"
                      posterPath={item.poster_path}
                      rating={item.rating}
                      basePath="/profile"
                      editing={editingType === "series"}
                      onRemove={() => handleRemoveFavorite("series", item)}
                      drag={drag}
                      style={{
                        width: favoritesCardWidth,
                        marginRight: index === series.length - 1 && seriesEmptyKeys.length === 0 ? 0 : FAVORITES_GAP,
                        marginBottom: 0,
                      }}
                    />
                  )}
                />
              );
            })()}
          </View>
        )}

        {hasVisited("cinegraph") && (
          <View style={visibility("cinegraph")}>
            <ProfileCinegraphsTab cineGraph={cineGraph} subTab={cinegraphSubTab} />
          </View>
        )}

        {hasVisited("analyses") && (
          <View style={visibility("analyses")}>
            <ProfileAnalysesTab onViewAnalysis={handleViewAnalysis} />
          </View>
        )}

        {hasVisited("badges") && (
          <View style={visibility("badges")}>
            <ProfileBadgesTab active={category === "badges"} screenFocused={screenFocused} />
          </View>
        )}
      </Animated.View>

      <AddFavoriteModal
        visible={addingType !== null && screenFocused}
        type={addingType ?? "movie"}
        excludeIds={favoriteExcludeIds}
        onClose={() => setAddingType(null)}
        onAdd={(item) => addingType && handleAddFavorite(addingType, item)}
      />

      <CollectionUndoBar
        entry={undoEntry}
        message={t("Removed from favorites")}
        durationMs={REMOVE_UNDO_MS}
        onUndo={handleUndoRemoveFavorite}
      />

      {/* Same screenFocused gate as AddFavoriteModal above, and for the same
          reason — tapping a title inside the analysis pushes its detail page,
          which would otherwise render behind this still-open Modal. Hiding
          (rather than closing) keeps `analysisModalVisible` true, so coming
          back re-shows the deck exactly where it was left. */}
      <ProfileAnalysisModal
        visible={analysisModalVisible && screenFocused}
        onClose={() => setAnalysisModalVisible(false)}
        data={analysisData}
        shareable
        navigable
      />
    </>
  );
}
