import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { saveReview, deleteReview } from "../api/reviewService";
import { createShare } from "../api/shareService";
import { useToast } from "../context/ToastContext";
import type { ContentType, Review } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  contentId: string;
  contentType: ContentType;
  myReview: Review | null;
  onSaved: (review: Review) => void;
  onDeleted: () => void;
}

export default function ReviewComposer({ contentId, contentType, myReview, onSaved, onDeleted }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  card: {},
  input: {
    minHeight: 70,
    textAlignVertical: "top",
    fontSize: 14,
    color: colors.baseContent,
    backgroundColor: colors.base300,
    borderRadius: 8,
    padding: 10,
  },
  error: { color: colors.error, fontSize: 12, marginTop: 6 },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 10 },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: { color: colors.placeholder, fontFamily: fonts.medium, fontSize: 12 },
  saveGroup: { position: "relative", flexDirection: "row", alignItems: "center" },
  saveButton: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  chevronButton: {
    backgroundColor: colors.primary,
    borderLeftWidth: 1,
    borderLeftColor: colors.primaryContent,
    opacity: 0.9,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 12 },
  dropdown: {
    position: "absolute",
    bottom: "100%",
    right: 0,
    marginBottom: 6,
    backgroundColor: colors.base200,
    borderRadius: 8,
    overflow: "hidden",
    minWidth: 200,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dropdownRow: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dropdownRowText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
  backdrop: { position: "absolute", top: -1000, left: -1000, right: -1000, bottom: -1000 },
}), [colors]);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [text, setText] = useState(myReview?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);

  useEffect(() => {
    setText(myReview?.text ?? "");
  }, [myReview?._id, myReview?.text]);

  const handleSave = async (alsoShareToMedia: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setShareMenuVisible(false);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveReview(contentId, contentType, trimmed);
      if (alsoShareToMedia) {
        try {
          await createShare({ type: "review", reviewId: saved._id });
          showToast(t("Shared to Medya"));
        } catch {
          // The review itself saved fine — a failed share shouldn't read as
          // a failed save, just surface it separately.
          showToast(t("Something went wrong. Please try again."));
        }
      }
      onSaved(saved);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to save review."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReview(myReview._id);
      setText("");
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to delete review."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.card}>
      <TextInput
        style={styles.input}
        placeholder={t("Write a review...")}
        placeholderTextColor={colors.placeholder}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonRow}>
        {myReview && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting || saving}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={styles.deleteButtonText}>{t("Delete")}</Text>
            )}
          </Pressable>
        )}
        <View style={styles.saveGroup}>
          {shareMenuVisible && (
            <>
              <Pressable style={styles.backdrop} onPress={() => setShareMenuVisible(false)} />
              <View style={styles.dropdown}>
                <Pressable style={styles.dropdownRow} onPress={() => handleSave(false)}>
                  <Text style={styles.dropdownRowText}>{t("Save Only")}</Text>
                </Pressable>
                <View style={styles.dropdownRowDivider} />
                <Pressable style={styles.dropdownRow} onPress={() => handleSave(true)}>
                  <Text style={styles.dropdownRowText}>{t("Save and Share to Medya")}</Text>
                </Pressable>
              </View>
            </>
          )}
          <Pressable
            style={[styles.saveButton, (!text.trim() || saving) && styles.saveButtonDisabled]}
            onPress={() => handleSave(false)}
            disabled={!text.trim() || saving || deleting}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primaryContent} />
            ) : (
              <Text style={styles.saveButtonText}>{t("Save")}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.chevronButton, (!text.trim() || saving) && styles.saveButtonDisabled]}
            onPress={() => setShareMenuVisible((v) => !v)}
            disabled={!text.trim() || saving || deleting}
            hitSlop={4}
          >
            <Ionicons name="chevron-down" size={14} color={colors.primaryContent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
