import { useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import TicketCard from "../../../../src/components/support/TicketCard";
import { useTickets } from "../../../../src/hooks/useTickets";
import { sortTickets } from "../../../../src/utils/tickets";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";

// Help & Feedback: everything this person has written to support, newest
// first, with anything newly answered lifted to the top. The cached list is
// on screen in the first frame; a visit after a while refreshes it
// underneath (src/hooks/useTickets.ts).
export default function SupportScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { tickets, failed, refreshing, refresh } = useTickets();
  const rows = useMemo(() => (tickets ? sortTickets(tickets) : null), [tickets]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        list: { padding: 16, paddingBottom: 96, flexGrow: 1 },
        caption: { fontSize: 13.5, lineHeight: 19, color: colors.placeholder, paddingBottom: 14 },
        state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 48 },
        stateIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
          marginBottom: 6,
        },
        stateTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent, textAlign: "center" },
        stateText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
        retry: { marginTop: 6, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.base200 },
        retryText: { fontFamily: fonts.bold, color: colors.baseContent },
        fab: {
          position: "absolute",
          right: 20,
          bottom: 28,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 52,
          paddingHorizontal: 20,
          borderRadius: 26,
          backgroundColor: colors.primary,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        fabText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.primaryContent },
      }),
    [colors]
  );

  const newTicket = () => router.push("/profile/support/new" as never);

  const empty = failed ? (
    <View style={styles.state}>
      <Text style={styles.stateText}>{t("Couldn't load your tickets.")}</Text>
      <Pressable style={styles.retry} onPress={refresh}>
        <Text style={styles.retryText}>{t("Try again")}</Text>
      </Pressable>
    </View>
  ) : rows === null ? (
    <View style={styles.state}>
      <ActivityIndicator color={colors.primary} />
    </View>
  ) : (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
      </View>
      <Text style={styles.stateTitle}>{t("How can we help?")}</Text>
      <Text style={styles.stateText}>{t("Report a bug, ask for a feature or get help with your account. We'll answer right here.")}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={rows ?? []}
        keyExtractor={(ticket) => ticket._id}
        ListHeaderComponent={
          rows && rows.length > 0 ? <Text style={styles.caption}>{t("We answer in the app, and let you know when we do.")}</Text> : null
        }
        renderItem={({ item }) => <TicketCard ticket={item} onPress={() => router.push(`/profile/support/${item._id}` as never)} />}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      />

      <Pressable style={styles.fab} onPress={newTicket} accessibilityRole="button" accessibilityLabel={t("New ticket")}>
        <Ionicons name="add" size={22} color={colors.primaryContent} />
        <Text style={styles.fabText}>{t("New ticket")}</Text>
      </Pressable>
    </View>
  );
}
