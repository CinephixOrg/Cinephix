import { useState, useMemo } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import { useChat } from "../context/ChatContext";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  sending: boolean;
  onConfirm: (conversationIds: string[]) => void;
}

// Recipient selection only — same Set<string> multi-select + checkbox
// convention as activity-log.tsx. Sends existing DM conversations only (see
// plan's scope note: mobile has no unified DM+group inbox, groups aren't
// pickable here). Shared between the recommendation-send flow and
// AnalyzeModal's Share button — title is caller-supplied since "Recommend
// Movie/Series" wouldn't make sense for the analysis-share case.
export default function RecipientPickerModal({ visible, title, onClose, sending, onConfirm }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { conversations } = useChat();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  const handleSend = () => {
    onConfirm(Array.from(selected));
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: { backgroundColor: colors.base200, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "75%" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
        rowInfo: { flex: 1 },
        username: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
        lastMessage: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
        empty: { textAlign: "center", color: colors.placeholder, padding: 24 },
        footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
        sendButton: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        sendButtonDisabled: { opacity: 0.5 },
        sendButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
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

          <FlatList
            data={conversations}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={<Text style={styles.empty}>{t("No conversations yet.")}</Text>}
            renderItem={({ item }) => {
              const isSelected = selected.has(item._id);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item._id)}>
                  <UserAvatar
                    userId={item.otherUser._id}
                    username={item.otherUser.username}
                    profilePicUrl={item.otherUser.profile_pic_url}
                    size={40}
                    disabled
                  />
                  <View style={styles.rowInfo}>
                    <Text style={styles.username}>{item.otherUser.username}</Text>
                    {item.lastMessage ? (
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.lastMessage}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={22}
                    color={isSelected ? colors.primary : colors.placeholder}
                  />
                </Pressable>
              );
            }}
          />

          <View style={styles.footer}>
            <Pressable
              style={[styles.sendButton, (selected.size === 0 || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={selected.size === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.primaryContent} />
              ) : (
                <Text style={styles.sendButtonText}>
                  {t("Send")} {selected.size > 0 ? `(${selected.size})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
