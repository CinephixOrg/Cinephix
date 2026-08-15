import { useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import NotificationBell from "../../../src/components/NotificationBell";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

function MessagesHeaderRight() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: { flexDirection: "row", alignItems: "center" },
        newButton: { marginRight: 12, padding: 4 },
      }),
    [colors]
  );
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.push("/messages/recommend")} hitSlop={8} style={styles.newButton}>
        <Ionicons name="gift-outline" size={22} color={colors.baseContent} />
      </Pressable>
      <Pressable onPress={() => router.push("/messages/new")} hitSlop={8} style={styles.newButton}>
        <Ionicons name="create-outline" size={22} color={colors.baseContent} />
      </Pressable>
      <NotificationBell />
    </View>
  );
}

export default function MessagesStackLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.base200 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.baseContent },
        headerTintColor: colors.baseContent,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t("Messages"), headerRight: () => <MessagesHeaderRight /> }}
      />
      <Stack.Screen name="new" options={{ title: t("New Message"), presentation: "modal" }} />
      <Stack.Screen
        name="recommend"
        options={{ title: t("Recommend Movie/Series"), presentation: "modal" }}
      />
      <Stack.Screen name="[conversationId]" options={{ title: "" }} />
      <Stack.Screen name="content/[type]/[id]" options={{ title: "" }} />
    </Stack>
  );
}

