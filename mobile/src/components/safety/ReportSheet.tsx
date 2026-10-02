import { memo, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import SheetModal, { SheetHeader } from "../collection/SheetModal";
import { reportContent } from "../../api/safetyService";
import { MAX_REPORT_DETAILS, REPORT_ACTION_LABEL, reasonsFor, type ReportEntityType, type ReportReason } from "../../utils/safety";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { readableOn } from "../../utils/color";

export interface ReportTarget {
  entityType: ReportEntityType;
  entityId: string;
}

interface Props {
  visible: boolean;
  /** What's being reported — kept by the caller after closing, so the form doesn't empty mid-animation. */
  target: ReportTarget | null;
  onClose: () => void;
}

// The one report form for everything reportable: why (a short list that fits
// what's being reported), an optional note, send. After sending it says so
// and closes itself.
function ReportSheet({ visible, target, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form each time a report is opened.
  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails("");
    setSending(false);
    setSent(false);
    setError(null);
  }, [visible, target]);

  // The thanks stays up a moment, then the sheet closes itself.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(onClose, 1600);
    return () => clearTimeout(timer);
  }, [sent, onClose]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 8 },
        intro: { fontSize: 14, lineHeight: 20, color: colors.placeholder, marginBottom: 6 },
        option: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.base200,
        },
        optionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
        optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.baseContent },
        optionTextActive: { fontFamily: fonts.bold, color: colors.primary },
        label: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, marginTop: 10 },
        input: {
          minHeight: 88,
          maxHeight: 160,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base200,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: 15,
          color: colors.baseContent,
          textAlignVertical: "top",
        },
        counter: { alignSelf: "flex-end", fontSize: 11.5, color: colors.placeholder },
        error: { fontSize: 13.5, color: colors.error, textAlign: "center" },
        footer: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        send: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
        sendDisabled: { opacity: 0.4 },
        // Readable on every theme's error colour (some are pale corals).
        sendText: { fontFamily: fonts.bold, fontSize: 15.5, color: readableOn(colors.error) },
        done: { alignItems: "center", gap: 10, paddingVertical: 36, paddingHorizontal: 28, paddingBottom: insets.bottom + 36 },
        doneIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${colors.success}22`,
        },
        doneTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.baseContent },
        doneText: { fontSize: 14.5, lineHeight: 21, color: colors.placeholder, textAlign: "center" },
      }),
    [colors, insets.bottom]
  );

  const submit = async () => {
    if (!target || !reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await reportContent({ ...target, reason, description: details.trim() || undefined });
      setSent(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const title = target ? t(REPORT_ACTION_LABEL[target.entityType]) : "";

  return (
    <SheetModal visible={visible} onClose={onClose} header={<SheetHeader title={title} onClose={onClose} />}>
      {sent ? (
        <View style={styles.done} accessibilityLiveRegion="polite">
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={32} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>{t("Thanks for letting us know")}</Text>
          <Text style={styles.doneText}>{t("Our team will review it. The person won't know who reported them.")}</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={styles.intro}>{t("Why are you reporting this? Your report is anonymous.")}</Text>
            {target
              ? reasonsFor(target.entityType).map((option) => {
                  const active = reason === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setReason(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.85 }]}
                    >
                      <Ionicons
                        name={option.icon as keyof typeof Ionicons.glyphMap}
                        size={19}
                        color={active ? colors.primary : colors.baseContent}
                      />
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{t(option.label)}</Text>
                      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.primary : colors.border} />
                    </Pressable>
                  );
                })
              : null}
            <Text style={styles.label}>{t("Details (optional)")}</Text>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder={t("Anything that would help us understand")}
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={MAX_REPORT_DETAILS}
            />
            <Text style={styles.counter}>
              {details.length}/{MAX_REPORT_DETAILS}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={submit}
              disabled={!reason || sending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.send, (!reason || sending) && styles.sendDisabled, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              {sending ? <ActivityIndicator color={readableOn(colors.error)} /> : <Text style={styles.sendText}>{t("Send report")}</Text>}
            </Pressable>
          </View>
        </>
      )}
    </SheetModal>
  );
}

export default memo(ReportSheet);
