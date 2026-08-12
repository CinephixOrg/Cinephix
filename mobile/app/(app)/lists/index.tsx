import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { createList, deleteList, getMyLists } from "../../../src/api/listService";
import { SkeletonListRow } from "../../../src/components/Skeleton";
import type { CustomList } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

export default function ListsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    margin: 16,
    paddingVertical: 12,
  },
  newButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.base200,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent, flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePublic: { backgroundColor: colors.primary },
  badgePrivate: { backgroundColor: colors.border },
  badgeText: { fontSize: 10, fontFamily: fonts.medium, color: colors.baseContent },
  rowDescription: { color: colors.placeholder, fontSize: 13, marginTop: 4 },
  rowCount: { color: colors.placeholder, fontSize: 12, marginTop: 4 },
  deleteButton: { padding: 6 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
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
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const list = await createList({ name: name.trim(), description: description.trim(), isPublic });
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

  return (
    <View style={styles.container}>
      <Pressable style={styles.newButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={18} color={colors.primaryContent} />
        <Text style={styles.newButtonText}>{t("New List")}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonListRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/lists/${item._id}`)}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <View style={[styles.badge, item.isPublic ? styles.badgePublic : styles.badgePrivate]}>
                    <Text style={styles.badgeText}>{item.isPublic ? t("Public") : t("Private")}</Text>
                  </View>
                </View>
                {item.description ? (
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.rowCount}>{t("item_count", { count: item.items.length })}</Text>
              </View>
              <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </Pressable>
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

