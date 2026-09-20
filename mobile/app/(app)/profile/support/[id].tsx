import { useEffect, useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../../src/components/support/StatusBadge";
import { readTicket } from "../../../../src/api/ticketStore";
import { useTicket } from "../../../../src/hooks/useTickets";
import { TICKET_TYPE_LABEL, isTicketActive } from "../../../../src/utils/tickets";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";

// One ticket: what they wrote, and every answer support has sent, oldest
// first. Opening it clears the ticket's unread dot (here and on the server).
export default function TicketScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ticket, failed } = useTicket(id ?? "");

  useEffect(() => {
    if (id) readTicket(id);
  }, [id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { padding: 16, paddingBottom: 40, gap: 16 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
        stateText: { fontSize: 14.5, color: colors.placeholder, textAlign: "center" },
        header: { gap: 10 },
        badges: { flexDirection: "row", alignItems: "center", gap: 8 },
        type: { fontFamily: fonts.bold, fontSize: 12, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.4 },
        title: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 29, color: colors.baseContent },
        date: { fontSize: 12.5, color: colors.placeholder },
        card: {
          borderRadius: 18,
          padding: 16,
          backgroundColor: colors.base200,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          gap: 8,
        },
        replyCard: { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}44` },
        cardLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
        cardLabelText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.4 },
        replyLabelText: { color: colors.primary },
        body: { fontSize: 15, lineHeight: 22, color: colors.baseContent },
        waiting: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
        waitingText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.placeholder },
      }),
    [colors]
  );

  if (!ticket) {
    return (
      <View style={[styles.screen, styles.center]}>
        {failed ? <Text style={styles.stateText}>{t("Couldn't load this ticket.")}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const stamp = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.badges}>
          <Text style={styles.type}>{t(TICKET_TYPE_LABEL[ticket.type] ?? ticket.type)}</Text>
          <StatusBadge status={ticket.status} large />
        </View>
        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.date}>{stamp(ticket.createdAt)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardLabel}>
          <Ionicons name="person-outline" size={14} color={colors.placeholder} />
          <Text style={styles.cardLabelText}>{t("You wrote")}</Text>
        </View>
        <Text style={styles.body}>{ticket.description}</Text>
      </View>

      {ticket.replies.length > 0
        ? ticket.replies.map((reply, index) => (
            <View key={`${reply.createdAt}-${index}`} style={[styles.card, styles.replyCard]}>
              <View style={styles.cardLabel}>
                <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
                <Text style={[styles.cardLabelText, styles.replyLabelText]}>{t("Cinephix Support")}</Text>
              </View>
              <Text style={styles.body}>{reply.text}</Text>
              <Text style={styles.date}>{stamp(reply.createdAt)}</Text>
            </View>
          ))
        : null}

      {ticket.replies.length === 0 ? (
        <View style={styles.waiting}>
          <Ionicons name={isTicketActive(ticket.status) ? "time-outline" : "checkmark-done-outline"} size={16} color={colors.placeholder} />
          <Text style={styles.waitingText}>
            {isTicketActive(ticket.status) ? t("We've got this and will reply here.") : t("This ticket was closed without a reply.")}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
