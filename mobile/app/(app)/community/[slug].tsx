import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import {
  getGroupBySlug,
  getGroupMembers,
  getGroupMessages,
  joinGroup,
  leaveGroup,
  markGroupRead,
  sendGroupMessageRest,
} from "../../../src/api/groupService";
import { useChat } from "../../../src/context/ChatContext";
import ChatRoom from "../../../src/components/ChatRoom";
import { SkeletonGrid, SkeletonAvatarCell, SkeletonGroupDetailHeader } from "../../../src/components/Skeleton";
import type { Group, GroupMember } from "../../../src/types";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

type Tab = "Chat" | "Members" | "About";

const CATEGORY_COLOR: Record<string, string> = {
  director: colors.primary,
  genre: colors.secondary,
  era: colors.accent,
  style: colors.info,
};

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { joinRoom, leaveRoom } = useChat();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("Chat");

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getGroupBySlug(slug);
      setGroup(data);
      navigation.setOptions({ title: data.name });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Failed to load group."));
    }
  }, [slug]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (tab !== "Chat" || !group?.isMember) return;
    joinRoom("group", group._id);
    return () => leaveRoom("group", group._id);
  }, [tab, group?._id, group?.isMember]);

  useEffect(() => {
    if (tab !== "Members" || membersLoaded) return;
    setMembersLoading(true);
    getGroupMembers(slug)
      .then((items) => {
        const isMe = (m: GroupMember) => m.user._id === user?._id;
        setMembers([...items.filter(isMe), ...items.filter((m) => !isMe(m))]);
        setMembersLoaded(true);
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [tab, membersLoaded, slug]);

  const handleJoinLeave = async () => {
    if (!group) return;
    setActionLoading(true);
    try {
      if (group.isMember) {
        await leaveGroup(group.slug);
        setGroup({ ...group, isMember: false, memberCount: group.memberCount - 1 });
      } else {
        await joinGroup(group.slug);
        setGroup({ ...group, isMember: true, memberCount: group.memberCount + 1 });
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || t("Action failed."));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonGroupDetailHeader />
      </View>
    );
  }
  if (!group) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={[styles.badge, { backgroundColor: CATEGORY_COLOR[group.category] }]}>
            <Text style={styles.badgeText}>{t(group.category)}</Text>
          </View>
          <Pressable
            style={[styles.actionButton, group.isMember ? styles.leaveButton : styles.joinButton]}
            onPress={handleJoinLeave}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={group.isMember ? colors.error : colors.primaryContent} />
            ) : (
              <Text style={group.isMember ? styles.leaveButtonText : styles.joinButtonText}>
                {group.isMember ? t("Leave") : t("Join")}
              </Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.description}>{group.description}</Text>
        <View style={styles.memberRow}>
          <Ionicons name="people-outline" size={14} color={colors.placeholder} />
          <Text style={styles.memberCount}>
            {group.memberCount} {group.memberCount === 1 ? t("member") : t("members")}
          </Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(["Chat", "Members", "About"] as Tab[]).map((tabName) => (
          <Pressable
            key={tabName}
            style={[styles.tabButton, tab === tabName && styles.tabButtonActive]}
            onPress={() => setTab(tabName)}
          >
            <Text style={[styles.tabButtonText, tab === tabName && styles.tabButtonTextActive]}>
              {t(tabName)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "Chat" && (
        <ChatRoom
          roomType="group"
          roomId={group._id}
          canChat={group.isMember}
          emptyText={t("No messages yet. Start the conversation!")}
          fetchMessages={(before, limit) => getGroupMessages(group._id, before, limit)}
          markRead={() => markGroupRead(group._id)}
          sendRest={(text) => sendGroupMessageRest(group._id, text)}
        />
      )}

      {tab === "Members" &&
        (membersLoading ? (
          <View style={styles.membersList}>
            <SkeletonGrid count={9} columns={3} renderItem={() => <SkeletonAvatarCell />} />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.user._id}
            numColumns={3}
            contentContainerStyle={styles.membersList}
            renderItem={({ item }) => {
              const isMe = item.user._id === user?._id;
              return (
                <View style={[styles.memberCell, isMe && styles.memberCellSelf]}>
                  {item.user.profile_pic_url ? (
                    <Image source={{ uri: item.user.profile_pic_url }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                      <Text style={styles.memberAvatarFallbackText}>
                        {item.user.username.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberUsername} numberOfLines={1}>
                    {item.user.username}
                    {isMe ? ` ${t("(you)")}` : ""}
                  </Text>
                  <Text style={styles.memberJoined}>
                    {t("Joined")}{" "}
                    {new Date(item.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>{t("No members yet.")}</Text>}
          />
        ))}

      {tab === "About" && (
        <View style={styles.aboutContainer}>
          <Text style={styles.description}>{group.description}</Text>
          {group.tags.length > 0 && (
            <View style={styles.tagRow}>
              {group.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.createdAt}>
            {t("Created")}{" "}
            {new Date(group.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: fonts.medium, color: colors.primaryContent, textTransform: "capitalize" },
  actionButton: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, minWidth: 70, alignItems: "center" },
  joinButton: { backgroundColor: colors.primary },
  joinButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 13 },
  leaveButton: { borderWidth: 1, borderColor: colors.error },
  leaveButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 13 },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.baseContent, marginTop: 10 },
  description: { fontSize: 14, color: colors.baseContent, marginTop: 6, lineHeight: 20 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  memberCount: { fontSize: 12, color: colors.placeholder },
  tabRow: { flexDirection: "row", padding: 12, gap: 8 },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { fontFamily: fonts.medium, color: colors.baseContent, fontSize: 13 },
  tabButtonTextActive: { color: colors.primaryContent },
  membersList: { padding: 12 },
  memberCell: { width: "33.33%", alignItems: "center", padding: 10 },
  memberCellSelf: { opacity: 0.7 },
  memberAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.base200 },
  memberAvatarFallback: { alignItems: "center", justifyContent: "center" },
  memberAvatarFallbackText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  memberUsername: { fontSize: 12, color: colors.baseContent, marginTop: 6, maxWidth: 90 },
  memberJoined: { fontSize: 10, color: colors.placeholder, marginTop: 2 },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  aboutContainer: { padding: 16 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  tagChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: colors.baseContent },
  createdAt: { fontSize: 12, color: colors.placeholder, marginTop: 16 },
});
