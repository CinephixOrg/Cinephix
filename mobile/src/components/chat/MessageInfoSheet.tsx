import { memo, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import SheetModal, { SheetHeader } from "../collection/SheetModal";
import TierAvatarFrame from "../TierAvatarFrame";
import { getMessageReaders } from "../../api/conversationService";
import { dayHeading } from "../../utils/chatMessages";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { Message, MessageReader, RoomType } from "../../types";

const AVATAR_SIZE = 36;

/**
 * One of your messages, with who has read it and when — opened by holding
 * the message down. A DM says whether the other person has read it; a group
 * lists everyone who has, earliest first.
 */
function MessageInfoSheet({
  message,
  roomType,
  onClose,
}: {
  /** The message to describe; null keeps the sheet closed. */
  message: Message | null;
  roomType: RoomType;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [readers, setReaders] = useState<MessageReader[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Still shown while the sheet slides away after `message` goes back to null.
  const [shown, setShown] = useState(message);
  if (message && message !== shown) setShown(message);

  const messageId = message?._id;
  useEffect(() => {
    if (!messageId) return;
    let cancelled = false;
    setReaders(null);
    setFailed(false);
    getMessageReaders(messageId)
      .then((list) => !cancelled && setReaders(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { paddingHorizontal: 20, paddingBottom: 28, gap: 18 },
        preview: { alignSelf: "flex-end", maxWidth: "85%", borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.primary },
        previewText: { color: colors.primaryContent, fontSize: 15, lineHeight: 20 },
        card: { borderRadius: 16, backgroundColor: colors.base200, paddingHorizontal: 16, paddingVertical: 4 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
        rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        rowLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        rowValue: { fontSize: 13.5, color: colors.placeholder },
        sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5 },
        reader: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
        avatarFallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
        readerName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        muted: { fontSize: 14, color: colors.placeholder, paddingVertical: 10 },
      }),
    [colors]
  );

  // A receipt from before they were recorded has no time: just "Read".
  const when = (iso: string | null) => {
    if (!iso) return "";
    const day = dayHeading(iso, new Date(), i18n.language, { today: t("Today"), yesterday: t("Yesterday") });
    const time = new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day}, ${time}`;
  };

  let receipts;
  if (failed) {
    receipts = <Text style={styles.muted}>{t("Couldn't load who read this.")}</Text>;
  } else if (!readers) {
    receipts = <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />;
  } else if (roomType === "dm") {
    // The other person, if they've read it.
    const read = readers[0];
    receipts = (
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="checkmark-done" size={18} color={read ? colors.info : colors.placeholder} />
          <Text style={styles.rowLabel}>{t("Read")}</Text>
          <Text style={styles.rowValue}>{read ? when(read.at) : t("Not read yet")}</Text>
        </View>
      </View>
    );
  } else {
    receipts = (
      <View style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>
          {t("Read by")}
          {readers.length ? ` · ${readers.length}` : ""}
        </Text>
        {readers.length === 0 ? (
          <Text style={styles.muted}>{t("No one has read this yet")}</Text>
        ) : (
          readers.map(({ user, at }) => (
            <View key={user._id} style={styles.reader}>
              <TierAvatarFrame tier={user.accountTier} size={AVATAR_SIZE}>
                {(inner) =>
                  user.profile_pic_url ? (
                    <Image source={{ uri: user.profile_pic_url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
                  ) : (
                    <View style={[styles.avatarFallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
                      <Text style={styles.avatarFallbackText}>{user.username.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )
                }
              </TierAvatarFrame>
              <Text style={styles.readerName} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={styles.rowValue}>{when(at)}</Text>
            </View>
          ))
        )}
      </View>
    );
  }

  return (
    <SheetModal visible={!!message} onClose={onClose} header={<SheetHeader title={t("Message info")} onClose={onClose} />}>
      {shown ? (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.preview}>
            <Text style={styles.previewText} numberOfLines={4}>
              {shown.text}
            </Text>
          </View>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="checkmark" size={18} color={colors.placeholder} />
              <Text style={styles.rowLabel}>{t("Sent")}</Text>
              <Text style={styles.rowValue}>{when(shown.createdAt)}</Text>
            </View>
          </View>
          {receipts}
        </ScrollView>
      ) : null}
    </SheetModal>
  );
}

export default memo(MessageInfoSheet);
