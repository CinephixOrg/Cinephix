import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadTickets } from "../../api/ticketStore";
import { useUnreadTickets } from "../../hooks/useTickets";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// How many support answers are waiting, on Settings' Help & Feedback row.
// Renders nothing when there's nothing to read.
//
// Loads the tickets itself (cached, so it's one request at most): the badge
// is the point of the row, and waiting for someone to open Help & Feedback
// first would mean they never see it.
export default function UnreadDot() {
  const { colors } = useTheme();
  const unread = useUnreadTickets();

  useEffect(() => {
    loadTickets().catch(() => {
      // The row works without its badge.
    });
  }, []);

  if (unread === 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.primaryContent }]}>{unread > 9 ? "9+" : unread}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.bold, fontSize: 12 },
});
