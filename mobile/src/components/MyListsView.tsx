import { useCallback, useState, useMemo, type ReactElement } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { createList, deleteList, getMyLists, reorderLists } from "../api/listService";
import { SkeletonListRow } from "./Skeleton";
import MyListCard from "./MyListCard";
import type { CustomList } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useBadgeEarned } from "../context/BadgeEarnedContext";
import { fonts } from "../theme/typography";

interface Props {
  // Rendered above the intro text, scrolling together with the list —
  // used to embed the Profile screen's header + sub-tab row when this view
  // is shown inside Profile's Lists tab instead of its own top-level route.
  ListHeaderComponent?: ReactElement | null;
}

// Shared between the top-level Lists tab (app/(app)/lists/index.tsx) and the
// Profile screen's Lists sub-tab — both just show the current user's own
// lists, so this is the one place that CRUD + reorder logic lives.
export default function MyListsView({ ListHeaderComponent }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  intro: { paddingHorizontal: 16, paddingTop: 12 },
  introLine: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, textAlign: "center", lineHeight: 18 },
  actionRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 12, marginBottom: 4 },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.base200,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonActive: { backgroundColor: colors.primary },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  error: { color: colors.error, textAlign: "center", marginBottom: 8, marginTop: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: colors.base200, borderRadius: 12, padding: 20 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.baseContent, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base100,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.baseContent,
    marginBottom: 10,
  },
  descInput: { minHeight: 70, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  switchLabel: { color: colors.baseContent, fontSize: 15 },
  modalButtonRow: { flexDirection: "row", gap: 10 },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: { color: colors.baseContent, fontFamily: fonts.medium },
  modalCreateButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCreateText: { color: colors.primaryContent, fontFamily: fonts.bold },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const { reportEarnedBadges } = useBadgeEarned();
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyLists();
      setLists(data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load lists."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { list, newlyEarnedBadges } = await createList({ name: name.trim(), description: description.trim(), isPublic });
      reportEarnedBadges(newlyEarnedBadges);
      setModalVisible(false);
      setName("");
      setDescription("");
      setIsPublic(false);
      router.push(`/lists/${list._id}`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to create list."));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (list: CustomList) => {
    Alert.alert(t("Delete List"), t("Delete list question", { name: list.name }), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteList(list._id);
            setLists((prev) => prev.filter((l) => l._id !== list._id));
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.message || t("Failed to delete list."));
          }
        },
      },
    ]);
  };

  const handleReorder = async (newOrder: CustomList[]) => {
    const prev = lists;
    setLists(newOrder);
    try {
      await reorderLists(newOrder.map((l) => l._id));
    } catch (e: any) {
      setLists(prev);
      Alert.alert("Error", e?.response?.data?.message || t("Failed to reorder lists."));
    }
  };

  const header = (
    <>
      {ListHeaderComponent}
      <View style={styles.intro}>
        <Text style={styles.introLine}>
          {t("Add movies and shows to custom lists, then share them with friends.")}
        </Text>
        <Text style={styles.introLine}>{t("Tap Edit to reorder or delete your lists.")}</Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          accessibilityLabel={t("New List")}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color={colors.primaryContent} />
        </Pressable>
        <Pressable
          style={[styles.editButton, editMode && styles.editButtonActive]}
          onPress={() => setEditMode((v) => !v)}
          accessibilityLabel={t("Edit")}
          hitSlop={8}
        >
          <Ionicons name="pencil" size={16} color={editMode ? colors.primaryContent : colors.baseContent} />
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.list}>
          {header}
          {[0, 1, 2, 3].map((i) => (
            <SkeletonListRow key={i} />
          ))}
        </View>
      ) : (
        <DraggableFlatList
          data={lists}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          onDragEnd={({ data }) => handleReorder(data)}
          renderItem={({ item, drag, isActive }: RenderItemParams<CustomList>) => (
            <MyListCard
              list={item}
              editMode={editMode}
              onDelete={() => handleDelete(item)}
              onPress={() => router.push(`/lists/${item._id}`)}
              onLongPress={editMode ? drag : undefined}
              isActive={isActive}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t("You haven't created any lists yet.")}</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("New List")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Name")}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, styles.descInput]}
              placeholder={t("Description (optional)")}
              value={description}
              onChangeText={setDescription}
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
            <View style={styles.modalButtonRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
                disabled={creating}
              >
                <Text style={styles.modalCancelText}>{t("Cancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.modalCreateButton}
                onPress={handleCreate}
                disabled={creating || !name.trim()}
              >
                {creating ? (
                  <ActivityIndicator color={colors.primaryContent} />
                ) : (
                  <Text style={styles.modalCreateText}>{t("Create List")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
