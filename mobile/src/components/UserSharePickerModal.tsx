import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import { getFollowers, getFollowing, searchUsers } from "../api/userService";
import { getAllGroups } from "../api/groupService";
import { useTheme } from "../context/ThemeContext";
import type { Connection, Group, UserSearchResult } from "../types";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  sending: boolean;
  onConfirm: (userIds: string[], groupIds: string[]) => void;
  // Off by default — messages/recommend.tsx's caller only handles DM
  // recipients today, so it deliberately doesn't opt in. ProfileAnalysisModal
  // sets this true to also list the user's joined communities as targets.
  showGroups?: boolean;
}

type Row = Connection | UserSearchResult;

type Entry =
  | { kind: "header"; key: string; label: string }
  | { kind: "group"; key: string; id: string; group: Group }
  | { kind: "user"; key: string; id: string; user: Row };

// Broader recipient picker for Profile Analysis sharing — search by username
// plus a default following/followers list, matching web's
// ShareSelectionModal.jsx. Deliberately a separate component from
// RecipientPickerModal (existing-DM-conversations-only): different data
// model entirely (user ids, not conversation ids), and that scope reduction
// was never meant to be undone for messages/recommend.tsx, only here.
// Also lists the groups/communities the user has joined, so an analysis can
// be shared into a community, not just DM'd to individual people.
export default function UserSharePickerModal({
  visible,
  title,
  onClose,
  sending,
  onConfirm,
  showGroups,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState<Row[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [searchResults, setSearchResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([
      getFollowing(1, 100),
      getFollowers(1, 100),
      showGroups ? getAllGroups() : Promise.resolve<Group[]>([]),
    ])
      .then(([following, followers, groups]) => {
        const map = new Map<string, Row>();
        following.items.forEach((u) => map.set(u._id, u));
        followers.items.forEach((u) => map.set(u._id, u));
        setConnections(Array.from(map.values()));
        setMyGroups(groups.filter((g) => g.isMember));
      })
      .catch(() => {
        setConnections([]);
        setMyGroups([]);
      })
      .finally(() => setLoading(false));
  }, [visible, showGroups]);

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

  const trimmedQuery = query.trim();
  const filteredGroups = trimmedQuery
    ? myGroups.filter((g) => g.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : myGroups;
  const userRows = trimmedQuery ? searchResults : connections;

  const entries = useMemo<Entry[]>(() => {
    const result: Entry[] = [];
    if (filteredGroups.length > 0) {
      result.push({ kind: "header", key: "h-groups", label: t("Communities") });
      filteredGroups.forEach((g) =>
        result.push({ kind: "group", key: `g-${g._id}`, id: g._id, group: g })
      );
    }
    if (userRows.length > 0) {
      result.push({ kind: "header", key: "h-people", label: t("People") });
      userRows.forEach((u) => result.push({ kind: "user", key: `u-${u._id}`, id: u._id, user: u }));
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGroups, userRows, t]);

  const toggle = (compositeKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
      return next;
    });
  };

  const handleClose = () => {
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const handleShare = () => {
    const userIds: string[] = [];
    const groupIds: string[] = [];
    selected.forEach((compositeKey) => {
      if (compositeKey.startsWith("user:")) userIds.push(compositeKey.slice(5));
      else if (compositeKey.startsWith("group:")) groupIds.push(compositeKey.slice(6));
    });
    onConfirm(userIds, groupIds);
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
        sectionHeader: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.placeholder,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 6,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
        groupIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.base300,
          alignItems: "center",
          justifyContent: "center",
        },
        rowInfo: { flex: 1 },
        username: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        groupMemberCount: { fontSize: 12, color: colors.placeholder, marginTop: 1 },
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
              placeholder={showGroups ? t("Search users or communities...") : t("Search users...")}
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
              data={entries}
              keyExtractor={(entry) => entry.key}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {trimmedQuery ? t("No users or communities found.") : t("No connections found.")}
                </Text>
              }
              renderItem={({ item: entry }) => {
                if (entry.kind === "header") {
                  // .toUpperCase() (not textTransform) — see AnalyzeModal.tsx
                  // for why: native uppercase casing follows the device's OS
                  // locale, not the app's selected language.
                  return <Text style={styles.sectionHeader}>{entry.label.toUpperCase()}</Text>;
                }

                if (entry.kind === "group") {
                  const compositeKey = `group:${entry.id}`;
                  const isSelected = selected.has(compositeKey);
                  return (
                    <Pressable style={styles.row} onPress={() => toggle(compositeKey)}>
                      <View style={styles.groupIcon}>
                        <Ionicons name="people" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.username} numberOfLines={1}>
                          {entry.group.name}
                        </Text>
                        <Text style={styles.groupMemberCount}>
                          {t("{{count}} members", { count: entry.group.memberCount })}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? colors.primary : colors.placeholder}
                      />
                    </Pressable>
                  );
                }

                const compositeKey = `user:${entry.id}`;
                const isSelected = selected.has(compositeKey);
                return (
                  <Pressable style={styles.row} onPress={() => toggle(compositeKey)}>
                    <UserAvatar
                      userId={entry.user._id}
                      username={entry.user.username}
                      profilePicUrl={entry.user.profile_pic_url}
                      size={40}
                      disabled
                    />
                    <Text style={styles.username}>{entry.user.username}</Text>
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
