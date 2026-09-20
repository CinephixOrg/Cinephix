import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
// A Modal needs its own gesture root for the app's Pressables to work inside it.
import Modal from "./common/GestureModal";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import { getFollowers, getFollowing, searchUsers } from "../api/userService";
import { loadCommunities } from "../api/communitiesStore";
import { useTheme } from "../context/ThemeContext";
import type { Connection, Group, UserSearchResult } from "../types";
import { fonts } from "../theme/typography";
import { localeUpper } from "../utils/text";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  sending: boolean;
  onConfirm: (userIds: string[], groupIds: string[]) => void;
  // Recommend flow only — messages/recommend.tsx can also target a joined
  // community, since a recommendation is just a rich group message like any
  // other. ProfileAnalysisModal doesn't pass this (analysis_share isn't
  // supported for group rooms on the backend), so it keeps the plain
  // users-only picker it always had.
  allowGroups?: boolean;
}

type Row = Connection | UserSearchResult;
type MainTab = "users" | "community";

// Broader recipient picker for Profile Analysis sharing — search by username
// plus a default following/followers list, matching web's
// ShareSelectionModal.jsx. Deliberately a separate component from
// RecipientPickerModal (existing-DM-conversations-only): different data
// model entirely (user ids, not conversation ids), and that scope reduction
// was never meant to be undone for messages/recommend.tsx, only here.
export default function UserSharePickerModal({ visible, title, onClose, sending, onConfirm, allowGroups }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<MainTab>("users");
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState<Row[]>([]);
  const [searchResults, setSearchResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

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
    if (!visible || !allowGroups) return;
    setGroupsLoading(true);
    // The Communities page's cached list, when it has one.
    loadCommunities()
      .then((all) => setGroups(all.filter((g) => g.isMember)))
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [visible, allowGroups]);

  useEffect(() => {
    const trimmed = query.trim();
    if (mainTab !== "users" || !trimmed) {
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
  }, [query, mainTab]);

  const displayList = query.trim() ? searchResults : connections;
  const filteredGroups = query.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
    : groups;

  const switchMainTab = (tab: MainTab) => {
    setMainTab(tab);
    setQuery("");
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setQuery("");
    setSelected(new Set());
    setSelectedGroups(new Set());
    setMainTab("users");
    onClose();
  };

  const handleShare = () => {
    onConfirm(Array.from(selected), Array.from(selectedGroups));
  };

  const totalSelected = selected.size + selectedGroups.size;

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
        tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
        tabButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
        tabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
        tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
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
        sectionLabel: {
          fontFamily: fonts.medium,
          fontSize: 12,
          color: colors.placeholder,
          letterSpacing: 0.5,
          paddingHorizontal: 16,
          paddingBottom: 6,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
        username: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
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

          {allowGroups && (
            <View style={styles.tabBar}>
              <Pressable
                style={[styles.tabButton, mainTab === "users" && styles.tabButtonActive]}
                onPress={() => switchMainTab("users")}
              >
                <Text style={[styles.tabText, mainTab === "users" && styles.tabTextActive]}>{t("Users")}</Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, mainTab === "community" && styles.tabButtonActive]}
                onPress={() => switchMainTab("community")}
              >
                <Text style={[styles.tabText, mainTab === "community" && styles.tabTextActive]}>
                  {t("Community")}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.placeholder} />
            <TextInput
              style={styles.searchInput}
              placeholder={mainTab === "users" ? t("Search users...") : t("Search community...")}
              placeholderTextColor={colors.placeholder}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>

          {mainTab === "users" ? (
            loading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
            ) : (
              <FlatList
                data={displayList}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                  !query.trim() ? <Text style={styles.sectionLabel}>{localeUpper(t("Network"))}</Text> : null
                }
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
            )
          ) : groupsLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
          ) : (
            <FlatList
              data={filteredGroups}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {query.trim() ? t("No results found.") : t("You haven't joined any communities yet.")}
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = selectedGroups.has(item._id);
                return (
                  <Pressable style={styles.row} onPress={() => toggleGroup(item._id)}>
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.username}>{item.name}</Text>
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
              style={[styles.shareButton, (totalSelected === 0 || sending) && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={totalSelected === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.primaryContent} />
              ) : (
                <Text style={styles.shareButtonText}>
                  {t("Share")} {totalSelected > 0 ? `(${totalSelected})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
