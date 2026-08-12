import { useState, useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import { importFromTVTime, importFromLetterboxd } from "../../../src/api/importService";
import type { ImportResult, ImportSource } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

interface PickedFile {
  uri: string;
  name: string;
}

export default function ImportDataScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100, padding: 20 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  radioDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioLabel: { color: colors.baseContent, fontSize: 14 },
  chooseButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  chooseButtonText: { color: colors.baseContent, fontFamily: fonts.medium, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14, color: colors.baseContent },
  rowValue: { flex: 1, fontSize: 14, color: colors.placeholder },
  clearText: { color: colors.error, fontFamily: fonts.medium, fontSize: 13 },
  warningBox: {
    backgroundColor: colors.base200,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  warningText: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: { color: colors.error, fontSize: 13, marginTop: 8 },
  resultCard: {
    backgroundColor: colors.base200,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  resultText: { color: colors.success, fontFamily: fonts.medium, fontSize: 14 },
}), [colors]);
  const { t } = useTranslation();

  const [source, setSource] = useState<ImportSource>("letterboxd");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const changeSource = (next: ImportSource) => {
    setSource(next);
    setPickedFile(null);
    setPickError(null);
    setResult(null);
    setUploadError(null);
  };

  const handleChooseFile = async () => {
    setPickError(null);
    setResult(null);
    setUploadError(null);
    const doc = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (doc.canceled) return;
    const asset = doc.assets[0];
    if (!asset.name.toLowerCase().endsWith(".zip")) {
      setPickError(t("Please select a .zip file."));
      return;
    }
    setPickedFile({ uri: asset.uri, name: asset.name });
  };

  const clearFile = () => {
    setPickedFile(null);
    setPickError(null);
  };

  const handleUpload = async () => {
    if (!pickedFile) return;
    setUploading(true);
    setUploadError(null);
    setResult(null);
    try {
      const fn = source === "letterboxd" ? importFromLetterboxd : importFromTVTime;
      const res = await fn(pickedFile.uri, pickedFile.name);
      if (res.status === "error") {
        setUploadError(res.message || t("Import failed."));
      } else {
        setResult(res);
        setPickedFile(null);
      }
    } catch (e: any) {
      setUploadError(e?.response?.data?.message || e?.message || t("Import failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.radioRow} onPress={() => changeSource("letterboxd")}>
        <View style={[styles.radioDot, source === "letterboxd" && styles.radioDotActive]} />
        <Text style={styles.radioLabel}>Letterboxd</Text>
      </Pressable>
      <Pressable style={styles.radioRow} onPress={() => changeSource("tvtime")}>
        <View style={[styles.radioDot, source === "tvtime" && styles.radioDotActive]} />
        <Text style={styles.radioLabel}>TV Time</Text>
      </Pressable>

      <Pressable style={styles.chooseButton} onPress={handleChooseFile} disabled={uploading}>
        <Text style={styles.chooseButtonText}>{t("Choose File")}</Text>
      </Pressable>

      {pickError && <Text style={styles.error}>{pickError}</Text>}

      {pickedFile && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t("Selected file:")}</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {pickedFile.name}
          </Text>
          <Pressable onPress={clearFile} hitSlop={8}>
            <Text style={styles.clearText}>{t("Clear")}</Text>
          </Pressable>
        </View>
      )}

      {pickedFile && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            {t(
              "Imports can take a few minutes for large libraries. Keep the app open in the foreground until it finishes — backgrounding it may interrupt the upload."
            )}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.uploadButton, (!pickedFile || uploading) && styles.uploadButtonDisabled]}
        onPress={handleUpload}
        disabled={!pickedFile || uploading}
      >
        {uploading ? (
          <View style={styles.rowCenter}>
            <ActivityIndicator color={colors.primaryContent} />
            <Text style={styles.uploadButtonText}>{t("Importing…")}</Text>
          </View>
        ) : (
          <Text style={styles.uploadButtonText}>{t("Upload Export ZIP")}</Text>
        )}
      </Pressable>

      {uploadError && <Text style={styles.error}>{uploadError}</Text>}

      {result && result.status === "completed" && (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>
            {result.importedEpisodes !== undefined
              ? t("Imported {{movies}} movies and {{episodes}} episodes.", {
                  movies: result.importedMovies ?? 0,
                  episodes: result.importedEpisodes ?? 0,
                })
              : t("Imported {{movies}} movies.", { movies: result.importedMovies ?? 0 })}
          </Text>
        </View>
      )}
    </View>
  );
}

