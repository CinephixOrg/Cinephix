import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { submitTicket } from "../../../../src/api/ticketStore";
import { TICKET_TYPE_OPTIONS } from "../../../../src/utils/tickets";
import { useToast } from "../../../../src/context/ToastContext";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";
import type { TicketType } from "../../../../src/types";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;

// Writing to support: what kind of thing it is, a one-line summary and the
// details. The type is picked from cards rather than a dropdown — four
// options read faster than a menu, and each says what it's for.
export default function NewTicketScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();

  const [type, setType] = useState<TicketType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { padding: 16, paddingBottom: 40, gap: 22 },
        label: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
        types: { gap: 8 },
        typeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        typeRowActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
        typeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.base300 },
        typeIconActive: { backgroundColor: `${colors.primary}26` },
        typeText: { flex: 1, minWidth: 0 },
        typeLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        typeDescription: { fontSize: 12.5, lineHeight: 17, color: colors.placeholder, marginTop: 1 },
        input: {
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15.5,
          fontFamily: fonts.regular,
          color: colors.baseContent,
        },
        textarea: { minHeight: 150, textAlignVertical: "top", lineHeight: 21 },
        counter: { alignSelf: "flex-end", marginTop: 6, fontSize: 11.5, color: colors.placeholder },
        submit: {
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
        submitDisabled: { opacity: 0.45 },
        submitText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryContent },
        hint: { fontSize: 12.5, lineHeight: 18, color: colors.placeholder, textAlign: "center" },
      }),
    [colors]
  );

  const ready = Boolean(type) && title.trim().length >= 3 && description.trim().length >= 10;

  const send = async () => {
    if (!ready || !type || sending) return;
    setSending(true);
    try {
      await submitTicket({ type, title: title.trim(), description: description.trim() });
      showToast(t("Thanks — we've got your ticket."), "success");
      router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.label}>{t("What's this about?")}</Text>
          <View style={styles.types}>
            {TICKET_TYPE_OPTIONS.map((option) => {
              const active = type === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setType(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.typeRow, active && styles.typeRowActive, pressed && { opacity: 0.85 }]}
                >
                  <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                    <Ionicons name={option.icon} size={19} color={active ? colors.primary : colors.placeholder} />
                  </View>
                  <View style={styles.typeText}>
                    <Text style={styles.typeLabel}>{t(option.label)}</Text>
                    <Text style={styles.typeDescription}>{t(option.description)}</Text>
                  </View>
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={styles.label}>{t("Title")}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE}
            placeholder={t("A short summary")}
            placeholderTextColor={colors.placeholder}
            returnKeyType="next"
          />
          <Text style={styles.counter}>
            {title.length}/{MAX_TITLE}
          </Text>
        </View>

        <View>
          <Text style={styles.label}>{t("Details")}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            maxLength={MAX_DESCRIPTION}
            multiline
            placeholder={t("What happened, and what you expected instead. The more detail, the faster we can help.")}
            placeholderTextColor={colors.placeholder}
          />
          <Text style={styles.counter}>
            {description.length}/{MAX_DESCRIPTION}
          </Text>
        </View>

        <Pressable
          onPress={send}
          disabled={!ready || sending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submit, (!ready || sending) && styles.submitDisabled, pressed && { opacity: 0.85 }]}
        >
          {sending ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.submitText}>{t("Send ticket")}</Text>}
        </Pressable>
        <Text style={styles.hint}>{t("We'll reply in Help & Feedback and notify you on this device.")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
