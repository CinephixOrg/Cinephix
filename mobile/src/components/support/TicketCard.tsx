import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import StatusBadge from "./StatusBadge";
import { TICKET_TYPE_LABEL } from "../../utils/tickets";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { Ticket } from "../../types";

interface Props {
  ticket: Ticket;
  onPress: () => void;
}

// One ticket in Help & Feedback: what it was about, when it was written, how
// it's going — and a dot when support has answered since they last read it.
function TicketCard({ ticket, onPress }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 18,
          backgroundColor: colors.base200,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 12,
          gap: 10,
        },
        pressed: { opacity: 0.85 },
        topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        type: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
        typeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.4 },
        title: { fontFamily: fonts.extrabold, fontSize: 16.5, lineHeight: 22, color: colors.baseContent },
        reply: { flexDirection: "row", alignItems: "center", gap: 6 },
        replyText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.placeholder },
        replyTextUnread: { color: colors.baseContent, fontFamily: fonts.medium },
        footer: { flexDirection: "row", alignItems: "center", gap: 8 },
        date: { flex: 1, fontSize: 12.5, color: colors.placeholder },
        dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
      }),
    [colors]
  );

  const date = new Date(ticket.createdAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });
  const answered = Boolean(ticket.adminReply);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.title}, ${t(ticket.status)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.type}>
          <Ionicons name="pricetag-outline" size={13} color={colors.placeholder} />
          <Text style={styles.typeText} numberOfLines={1}>
            {t(TICKET_TYPE_LABEL[ticket.type] ?? ticket.type)}
          </Text>
        </View>
        <StatusBadge status={ticket.status} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {ticket.title}
      </Text>

      {answered ? (
        <View style={styles.reply}>
          <Ionicons name="chatbubble-ellipses" size={14} color={ticket.hasUnreadReply ? colors.primary : colors.placeholder} />
          <Text style={[styles.replyText, ticket.hasUnreadReply && styles.replyTextUnread]} numberOfLines={1}>
            {ticket.hasUnreadReply ? t("New reply from support") : ticket.adminReply}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.date}>{date}</Text>
        {ticket.hasUnreadReply ? <View style={styles.dot} /> : null}
        <Ionicons name="chevron-forward" size={16} color={colors.placeholder} />
      </View>
    </Pressable>
  );
}

export default memo(TicketCard);
