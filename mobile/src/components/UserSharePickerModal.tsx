import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import { getFollowers, getFollowing, searchUsers } from "../api/userService";
import { useTheme } from "../context/ThemeContext";
import type { Connection, UserSearchResult } from "../types";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  sending: boolean;
  onConfirm: (userIds: string[]) => void;
}

type Row = Connection | UserSearchResult;

// Broader recipient picker for Profile Analysis sharing — search by username
// plus a default following/followers list, matching web's
// ShareSelectionModal.jsx. Deliberately a separate component from
// RecipientPickerModal (existing-DM-conversations-only): different data
// model entirely (user ids, not conversation ids), and that scope reduction
// was never meant to be undone for messages/recommend.tsx, only here.
export default function UserSharePickerModal({ visible, title, onClose, sending, onConfirm }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState<Row[]>([]);
  const [searchResults, setSearchResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([getFollowing(1, 100), getFollowers(1, 100)])
      .then(([following, followers]) => {
        const map = new Map<string, Row>();
        following.items.forEach((u) => map.set(u._id, u));
        followers.items.forEach((u) => map.set(u._id, u));
        setConnections(Array.from(map.values()));
      })
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
  }, [visible]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      searchUsers(trimmed)
        .then(({ items }) => {
          if (!cancelled) setSearchResults(items);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const displayList = query.trim() ? searchResults : connections;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const handleShare = () => {
    onConfirm(Array.from(selected));
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: { backgroundColor: colors.base200, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "80%" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          margin: 16,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base100,
          borderRadius: 8,
          paddingHorizontal: 12,
        },
        searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.baseContent },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
        username: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        empty: { textAlign: "center", color: colors.placeholder, padding: 24 },
        footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
        shareButton: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        shareButtonDisabled: { opacity: 0.5 },
        shareButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.baseContent} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.placeholder} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("Search users...")}
              placeholderTextColor={colors.placeholder}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
          ) : (
            <FlatList
              data={displayList}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {query.trim() ? t("No users found.") : t("No connections found.")}
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = selected.has(item._id);
                return (
                  <Pressable style={styles.row} onPress={() => toggle(item._id)}>
                    <UserAvatar
                      userId={item._id}
                      username={item.username}
                      profilePicUrl={item.profile_pic_url}
                      size={40}
                      disabled
                    />
                    <Text style={styles.username}>{item.username}</Text>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? colors.primary : colors.placeholder}
                    />
                  </Pressable>
                );
              }}
            />
          )}

          <View style={styles.footer}>
            <Pressable
              style={[styles.shareButton, (selected.size === 0 || sending) && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={selected.size === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.primaryContent} />
              ) : (
                <Text style={styles.shareButtonText}>
                  {t("Share")} {selected.size > 0 ? `(${selected.size})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
