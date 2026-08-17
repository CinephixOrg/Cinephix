import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { saveReview, deleteReview } from "../api/reviewService";
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
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 12 },
}), [colors]);
  const { t } = useTranslation();
  const [text, setText] = useState(myReview?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(myReview?.text ?? "");
  }, [myReview?._id, myReview?.text]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveReview(contentId, contentType, trimmed);
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
        <Pressable
          style={[styles.saveButton, (!text.trim() || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!text.trim() || saving || deleting}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryContent} />
          ) : (
            <Text style={styles.saveButtonText}>{t("Save")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

