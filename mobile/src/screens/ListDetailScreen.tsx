import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getListById, removeItem, toggleListLike, updateList } from "../api/listService";
import { createShare } from "../api/shareService";
import { getMovieById, getSeriesById } from "../api/contentService";
import MiniContentCard from "../components/MiniContentCard";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../context/ToastContext";
import { SkeletonBox, SkeletonGrid, SkeletonPosterCard } from "../components/Skeleton";
import type { ContentType, CustomListDetail, Movie, Series } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface HydratedItem {
  id: string;
  type: ContentType;
  content: Movie | Series;
}

type ItemTypeFilter = "all" | ContentType;
const ITEM_TYPE_FILTERS: ItemTypeFilter[] = ["all", "movie", "series"];

const GRID_COLUMNS = 6;
const GRID_GAP = 4;
const GRID_PADDING = 16; // matches styles.list's paddingHorizontal

interface Props {
  // Which tab's own nested Stack this screen is being rendered inside of —
  // forwarded to the item grid's MiniContentCard so its own content-detail
  // navigation stays within that same Stack (see ContentCard's basePath
  // comment). Defaults to "/lists" since that's this screen's original home.
  // "/profile" added alongside the new profile/lists/[id].tsx thin route,
  // needed so a "list" ShareCard tapped from the Profile tab's Sharings
  // view can navigate to this same screen within that tab's own Stack.
  basePath?: "/lists" | "/home" | "/search" | "/profile";
}

export default function ListDetailScreen({ basePath = "/lists" }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  header: { paddingTop: 16 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ownerName: { fontSize: 13, color: colors.placeholder, fontFamily: fonts.medium },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePublic: { backgroundColor: colors.primary },
  badgePrivate: { backgroundColor: colors.border },
  badgeText: { fontSize: 11, fontFamily: fonts.medium, color: colors.baseContent },
  description: { color: colors.baseContent, fontSize: 14, marginTop: 8, lineHeight: 20 },
  ownerActionsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  editButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
  // Icon-only, same border/radius/vertical-padding as editButton so the two
  // sit at matching height side by side — only shown for public lists
  // (sharing a private list to the public Medya feed doesn't make sense).
  shareButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 13, color: colors.placeholder },
  statTextActive: { color: colors.primary, fontFamily: fonts.medium },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.baseContent,
    marginBottom: 10,
  },
  descInput: { minHeight: 70, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  switchLabel: { color: colors.baseContent, fontSize: 15 },
  editButtonRow: { flexDirection: "row", gap: 10 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold },
  // Same compact sliding-pill segmented control as SharesFeedSection.tsx's
  // Recent/Popular/Network filter (colors.base200 pill, a spring-animated
  // colors.primary indicator behind the active segment) — replaces the old
  // full-width underline tab bar, which was both visually flat and took up
  // a whole extra row (paddingVertical:10 + its own bottom border).
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.base200,
    borderRadius: 10,
    padding: 3,
    marginTop: 14,
    marginBottom: 8,
    position: "relative",
  },
  segmentIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  segment: { flex: 1, paddingVertical: 7, alignItems: "center", zIndex: 1 },
  segmentText: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
  segmentTextActive: { color: colors.primaryContent, fontFamily: fonts.bold },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  errorText: { color: colors.error, marginTop: 8 },
}), [colors]);
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [list, setList] = useState<CustomListDetail | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sliding indicator for the All/Movies/Series segmented control — same
  // measured-width + spring-animated-translateX technique as
  // SharesFeedSection.tsx's Recent/Popular/Network control.
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const segmentIndicatorAnim = useRef(new Animated.Value(0)).current;
  const itemTypeFilterIndex = ITEM_TYPE_FILTERS.indexOf(itemTypeFilter);

  useEffect(() => {
    if (segmentedWidth === 0) return;
    const segmentWidth = (segmentedWidth - 6) / ITEM_TYPE_FILTERS.length;
    Animated.spring(segmentIndicatorAnim, {
      toValue: itemTypeFilterIndex * segmentWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [itemTypeFilterIndex, segmentedWidth]);

  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharingToMedia, setSharingToMedia] = useState(false);

  const load = useCallback(async () => {
    try {
      const { list: fetchedList, isOwner: owner, hasLiked: liked } = await getListById(id);
      setList(fetchedList);
      setIsOwner(owner);
      setName(fetchedList.name);
      setDescription(fetchedList.description);
      setIsPublic(fetchedList.isPublic);
      setLikeCount(fetchedList.likeCount);
      setHasLiked(liked);

      const hydrated = await Promise.all(
        fetchedList.items.map(async (it) => {
          const content =
            it.itemType === "movie" ? await getMovieById(it.itemId) : await getSeriesById(it.itemId);
          return { id: it.itemId, type: it.itemType, content };
        })
      );
      setItems(hydrated);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load list."));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updated = await updateList(id, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
      });
      setList((prev) => (prev ? { ...prev, ...updated, owner: prev.owner } : prev));
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to update list."));
    } finally {
      setSaving(false);
    }
  };

  const handleLike = async () => {
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likeCount;
    setHasLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLiking(true);
    try {
      const result = await toggleListLike(id);
      setHasLiked(result.hasLiked);
      setLikeCount(result.likeCount);
    } catch {
      setHasLiked(prevLiked);
      setLikeCount(prevCount);
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setLiking(false);
    }
  };

  // Mirrors ProfileAnalysisModal.tsx's handleShareToMedia exactly (single
  // direct action, no ShareOptionsMenu/DM picker — lists have no existing
  // DM-sharing precedent to preserve, same reasoning ReviewComposer.tsx's
  // simpler Save/Save+Share toggle already used).
  const handleShareToMedia = async () => {
    if (!list) return;
    setSharingToMedia(true);
    try {
      await createShare({ type: "list", listId: list._id });
      showToast(t("Shared to Medya"));
    } catch {
      showToast(t("Something went wrong. Please try again."));
    } finally {
      setSharingToMedia(false);
    }
  };

  const handleRemoveItem = async (itemId: string, itemType: ContentType) => {
    try {
      const updated = await removeItem(id, itemId, itemType);
      setList((prev) => (prev ? { ...prev, ...updated, owner: prev.owner } : prev));
      setItems((prev) => prev.filter((it) => it.id !== itemId));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to remove item."));
    }
  };

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor: colors.base100 }} contentContainerStyle={styles.list}>
        <View style={styles.header}>
          <SkeletonBox width="60%" height={22} />
          <SkeletonBox width="90%" height={13} style={{ marginTop: 10 }} />
          <SkeletonBox width={70} height={12} style={{ marginTop: 8 }} />
        </View>
        <SkeletonGrid count={4} columns={2} renderItem={() => <SkeletonPosterCard />} />
      </ScrollView>
    );
  }

  if (error && !list) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!list) return null;

  const filteredItems = items.filter((it) => itemTypeFilter === "all" || it.type === itemTypeFilter);

  return (
    <FlatList
      style={{ backgroundColor: colors.base100 }}
      data={filteredItems}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          {editing ? (
            <>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("Name")} />
              <TextInput
                style={[styles.input, styles.descInput]}
                value={description}
                onChangeText={setDescription}
                placeholder={t("Description")}
                multiline
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("Public")}</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <View style={styles.editButtonRow}>
                <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>{t("Cancel")}</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={handleSaveEdit} disabled={saving || !name.trim()}>
                  {saving ? (
                    <ActivityIndicator color={colors.primaryContent} />
                  ) : (
                    <Text style={styles.saveButtonText}>{t("Save")}</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable style={styles.ownerRow} onPress={() => router.push(`/user/${list.owner._id}`)}>
                <UserAvatar
                  userId={list.owner._id}
                  username={list.owner.username}
                  profilePicUrl={list.owner.profile_pic_url}
                  size={28}
                  disabled
                />
                <Text style={styles.ownerName}>{list.owner.username}</Text>
              </Pressable>

              <View style={styles.titleRow}>
                <Text style={styles.title}>{list.name}</Text>
                <View style={[styles.badge, list.isPublic ? styles.badgePublic : styles.badgePrivate]}>
                  <Text style={styles.badgeText}>{list.isPublic ? t("Public") : t("Private")}</Text>
                </View>
              </View>

              {list.description ? <Text style={styles.description}>{list.description}</Text> : null}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="film-outline" size={15} color={colors.placeholder} />
                  <Text style={styles.statText}>{t("item_count", { count: items.length })}</Text>
                </View>
                <Pressable style={styles.statItem} onPress={handleLike} disabled={liking} hitSlop={8}>
                  <Ionicons
                    name={hasLiked ? "heart" : "heart-outline"}
                    size={15}
                    color={hasLiked ? colors.primary : colors.placeholder}
                  />
                  <Text style={[styles.statText, hasLiked && styles.statTextActive]}>{likeCount}</Text>
                </Pressable>
                <View style={styles.statItem}>
                  <Ionicons name="eye-outline" size={15} color={colors.placeholder} />
                  <Text style={styles.statText}>{t("view_count", { count: list.views ?? 0 })}</Text>
                </View>
              </View>

              {isOwner && (
                <View style={styles.ownerActionsRow}>
                  <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                    <Text style={styles.editButtonText}>{t("Edit")}</Text>
                  </Pressable>
                  {list.isPublic && (
                    <Pressable style={styles.shareButton} onPress={handleShareToMedia} disabled={sharingToMedia} hitSlop={4}>
                      {sharingToMedia ? (
                        <ActivityIndicator size="small" color={colors.baseContent} />
                      ) : (
                        <Ionicons name="newspaper-outline" size={18} color={colors.baseContent} />
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.segmented} onLayout={(e) => setSegmentedWidth(e.nativeEvent.layout.width)}>
            {segmentedWidth > 0 && (
              <Animated.View
                style={[
                  styles.segmentIndicator,
                  { width: (segmentedWidth - 6) / ITEM_TYPE_FILTERS.length, transform: [{ translateX: segmentIndicatorAnim }] },
                ]}
              />
            )}
            {ITEM_TYPE_FILTERS.map((filter) => (
              <Pressable key={filter} style={styles.segment} onPress={() => setItemTypeFilter(filter)}>
                <Text style={[styles.segmentText, itemTypeFilter === filter && styles.segmentTextActive]}>
                  {filter === "all" ? t("All") : filter === "movie" ? t("Movies") : t("Series")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <MiniContentCard
          id={item.id}
          type={item.type}
          posterPath={item.content.poster_path}
          basePath={basePath}
          onRemove={isOwner ? () => handleRemoveItem(item.id, item.type) : undefined}
          style={{
            width: cardWidth,
            marginBottom: GRID_GAP,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
          }}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t("No items in this list yet.")}</Text>}
    />
  );
}
