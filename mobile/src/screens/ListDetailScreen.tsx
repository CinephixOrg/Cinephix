import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getListById, removeItem, updateList } from "../api/listService";
import { getMovieById, getSeriesById } from "../api/contentService";
import ContentCard from "../components/ContentCard";
import { SkeletonBox, SkeletonGrid, SkeletonPosterCard } from "../components/Skeleton";
import type { ContentType, CustomList, Movie, Series } from "../types";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

interface HydratedItem {
  id: string;
  type: ContentType;
  content: Movie | Series;
}

interface Props {
  // Which tab's own nested Stack this screen is being rendered inside of —
  // forwarded to the item grid's ContentCard so its own content-detail
  // navigation stays within that same Stack (see ContentCard's basePath
  // comment). Defaults to "/lists" since that's this screen's original home.
  basePath?: "/lists" | "/home";
}

export default function ListDetailScreen({ basePath = "/lists" }: Props) {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [list, setList] = useState<CustomList | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { list: fetchedList, isOwner: owner } = await getListById(id);
      setList(fetchedList);
      setIsOwner(owner);
      setName(fetchedList.name);
      setDescription(fetchedList.description);
      setIsPublic(fetchedList.isPublic);
      navigation.setOptions({ title: fetchedList.name });

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
      setList(updated);
      navigation.setOptions({ title: updated.name });
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to update list."));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string, itemType: ContentType) => {
    try {
      const updated = await removeItem(id, itemId, itemType);
      setList(updated);
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

  return (
    <FlatList
      style={{ backgroundColor: colors.base100 }}
      data={items}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      numColumns={2}
      columnWrapperStyle={styles.row}
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
              <View style={styles.titleRow}>
                <Text style={styles.title}>{list.name}</Text>
                <View style={[styles.badge, list.isPublic ? styles.badgePublic : styles.badgePrivate]}>
                  <Text style={styles.badgeText}>{list.isPublic ? t("Public") : t("Private")}</Text>
                </View>
              </View>
              {list.description ? <Text style={styles.description}>{list.description}</Text> : null}
              <Text style={styles.count}>{t("item_count", { count: items.length })}</Text>
              {isOwner && (
                <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                  <Text style={styles.editButtonText}>{t("Edit")}</Text>
                </Pressable>
              )}
            </>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <ContentCard
            id={item.id}
            type={item.type}
            title={item.type === "movie" ? (item.content as Movie).title : (item.content as Series).name}
            posterPath={item.content.poster_path}
            year={(item.type === "movie"
              ? (item.content as Movie).release_date
              : (item.content as Series).first_air_date
            )?.slice(0, 4)}
            voteAverage={item.content.vote_average}
            style={{ width: "100%" }}
            basePath={basePath}
          />
          {isOwner && (
            <Pressable
              style={styles.removeButton}
              onPress={() => handleRemoveItem(item.id, item.type)}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t("No items in this list yet.")}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  header: { paddingVertical: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.baseContent },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePublic: { backgroundColor: colors.primary },
  badgePrivate: { backgroundColor: colors.border },
  badgeText: { fontSize: 11, fontFamily: fonts.medium, color: colors.baseContent },
  description: { color: colors.baseContent, fontSize: 14, marginTop: 8 },
  count: { color: colors.placeholder, fontSize: 13, marginTop: 4 },
  editButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  editButtonText: { color: colors.baseContent, fontFamily: fonts.medium },
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
  cardWrap: { width: "48%" },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  errorText: { color: colors.error, marginTop: 8 },
});
