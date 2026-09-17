import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import {
  fetchImportSources,
  getCachedImportSources,
  runImport,
} from "../../../src/api/importService";
import ImportSourceGrid from "../../../src/components/import/ImportSourceGrid";
import { SkeletonImportSourceGrid } from "../../../src/components/Skeleton";
import ImportProgressPanel from "../../../src/components/import/ImportProgressPanel";
import ImportSummaryCard from "../../../src/components/import/ImportSummaryCard";
import { metaFor } from "../../../src/components/import/importSourceMeta";
import { useProfile } from "../../../src/context/ProfileContext";
import type {
  ImportProgress,
  ImportSourceInfo,
  ImportSummary,
} from "../../../src/types";

interface PickedFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// A step that fades and slides in once it becomes reachable, so the page
// reveals itself in the order it is meant to be worked through rather than
// showing every control at once.
function Step({
  index,
  title,
  subtitle,
  visible,
  children,
}: {
  index: number;
  title: string;
  subtitle?: string;
  visible: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  // Starts hidden and animates in whenever the step becomes reachable, so
  // picking a source reveals the next two steps rather than having them
  // already sitting there.
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      reveal.setValue(0);
      return;
    }
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reveal, visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
        badge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primaryContent },
        title: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, marginTop: 1 },
      }),
    [colors]
  );

  // Rendered only once reachable. An invisible-but-mounted step still
  // occupies its full height, which left a dead gap under the source grid
  // before anything had been chosen.
  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity: reveal,
        transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

export default function ImportScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { refresh } = useProfile();

  // Served from the session cache on every visit after the first, so the
  // grid is on screen immediately and the request only corrects it.
  const [sources, setSources] = useState<ImportSourceInfo[]>(getCachedImportSources);
  const [selected, setSelected] = useState<ImportSourceInfo | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImportSources().then((next) => {
      if (!cancelled) setSources(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // An import that is still running when the screen goes away would resolve
  // into unmounted state and hold the upload open for nothing.
  useEffect(() => () => abortRef.current?.(), []);

  const meta = selected ? metaFor(selected.id) : null;

  const handleSelectSource = useCallback((source: ImportSourceInfo) => {
    setSelected(source);
    // A file picked for one platform is meaningless for another.
    setFile(null);
    setError(null);
    setSummary(null);
  }, []);

  const handlePickFile = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setSummary(null);

    const result = await DocumentPicker.getDocumentAsync({
      // Extensions are checked below: the MIME types these files arrive with
      // vary by platform and picker, and filtering on them here hides valid
      // exports from the user entirely.
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const name = asset.name || "";
    const accepted = selected.accepts.some((extension) => name.toLowerCase().endsWith(extension));
    if (!accepted) {
      setError(
        t("That file type isn't supported for {{source}}. Expected {{formats}}.", {
          source: selected.label,
          formats: selected.accepts.join(", "),
        })
      );
      return;
    }

    setFile({ uri: asset.uri, name, size: asset.size ?? undefined, mimeType: asset.mimeType ?? undefined });
  }, [selected, t]);

  const handleImport = useCallback(async () => {
    if (!selected || !file) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    setProgress(null);

    try {
      const result = await runImport({
        sourceId: selected.id,
        fileUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        onProgress: setProgress,
        onStart: (abort) => {
          abortRef.current = abort;
        },
      });

      if (result.status === "error") {
        setError(result.message);
      } else {
        setSummary(result);
        setFile(null);
        // The profile's counts, lists and CineGraph all just changed, so
        // this has to beat the context's refresh window rather than be
        // swallowed by it.
        refresh({ force: true });
      }
    } catch (e: any) {
      setError(e?.message || t("Import failed."));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  }, [selected, file, refresh, t]);

  const handleReset = useCallback(() => {
    setSummary(null);
    setFile(null);
    setError(null);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { padding: 18, paddingBottom: 40, gap: 26 },
        hero: { gap: 6 },
        heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        heroTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.baseContent },
        heroText: { fontFamily: fonts.regular, fontSize: 13, color: colors.placeholder, lineHeight: 19 },
        guide: {
          backgroundColor: colors.base200,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        },
        guideHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
        guideTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, flex: 1 },
        guideStep: { flexDirection: "row", gap: 10 },
        guideBullet: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.primary,
          width: 14,
          lineHeight: 19,
        },
        guideText: { fontFamily: fonts.regular, fontSize: 13, color: colors.baseContent, flex: 1, lineHeight: 19 },
        formats: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
        chip: {
          backgroundColor: colors.base300,
          borderRadius: 6,
          paddingHorizontal: 7,
          paddingVertical: 3,
        },
        chipText: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        picker: {
          borderWidth: 1.5,
          borderColor: colors.border,
          borderStyle: "dashed",
          borderRadius: 16,
          paddingVertical: 26,
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.base200,
        },
        pickerTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        pickerHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder },
        fileCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.base200,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.primary,
          padding: 14,
        },
        fileName: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
        fileMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.placeholder, marginTop: 2 },
        cta: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 16,
        },
        ctaDisabled: { opacity: 0.45 },
        ctaText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
        cancel: { alignSelf: "center", paddingVertical: 10 },
        cancelText: { fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        errorBox: {
          flexDirection: "row",
          gap: 9,
          backgroundColor: colors.base200,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.error,
          padding: 13,
        },
        errorText: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, flex: 1, lineHeight: 17 },
        notice: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
        noticeText: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, flex: 1, lineHeight: 17 },
      }),
    [colors]
  );

  // While an import is running, the whole result view is what matters; the
  // setup steps stay on screen but stop accepting input.
  const locked = busy;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Ionicons name="cloud-download-outline" size={24} color={colors.primary} />
          <Text style={styles.heroTitle}>{t("Bring your library over")}</Text>
        </View>
        <Text style={styles.heroText}>
          {t(
            "Import what you've watched, rated and saved from another service. We match each title to our catalogue, so your ratings, watchlist and CineGraph pick up right where you left off."
          )}
        </Text>
      </View>

      {summary ? (
        <ImportSummaryCard summary={summary} onImportAnother={handleReset} />
      ) : (
        <>
          <Step index={1} title={t("Choose where you're coming from")} visible>
            {sources.length > 0 ? (
              <ImportSourceGrid
                sources={sources}
                selectedId={selected?.id ?? null}
                onSelect={handleSelectSource}
                disabled={locked}
              />
            ) : (
              <SkeletonImportSourceGrid />
            )}
          </Step>

          <Step
            index={2}
            title={t("Get your export file")}
            subtitle={selected ? selected.label : undefined}
            visible={!!selected}
          >
            {meta && selected && (
              <View style={styles.guide}>
                <View style={styles.guideHeader}>
                  <Ionicons name={meta.icon} size={18} color={meta.tint} />
                  <Text style={styles.guideTitle}>
                    {t("How to export from {{source}}", { source: selected.label })}
                  </Text>
                </View>
                {meta.steps.map((step, index) => (
                  <View key={step} style={styles.guideStep}>
                    <Text style={styles.guideBullet}>{index + 1}.</Text>
                    <Text style={styles.guideText}>{t(step)}</Text>
                  </View>
                ))}
                <View style={styles.formats}>
                  <Text style={styles.chipText}>{t("Accepted formats")}</Text>
                  {selected.accepts.map((extension) => (
                    <View key={extension} style={styles.chip}>
                      <Text style={styles.chipText}>{extension}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Step>

          <Step index={3} title={t("Upload it here")} visible={!!selected}>
            {file ? (
              <View style={styles.fileCard}>
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileMeta}>{formatSize(file.size) || t("Ready to import")}</Text>
                </View>
                <Pressable onPress={() => setFile(null)} hitSlop={10} disabled={locked}>
                  <Ionicons name="close-circle" size={22} color={colors.placeholder} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.picker} onPress={handlePickFile} disabled={locked}>
                <Ionicons name="folder-open-outline" size={26} color={colors.primary} />
                <Text style={styles.pickerTitle}>{t("Choose file")}</Text>
                <Text style={styles.pickerHint}>{meta?.fileHint ?? ""}</Text>
              </Pressable>
            )}
          </Step>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {busy && <ImportProgressPanel progress={progress} />}

          {!busy && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.placeholder} />
              <Text style={styles.noticeText}>
                {t(
                  "Large libraries can take a couple of minutes. Keep the app open until it finishes — nothing already in your profile is overwritten, and importing the same file twice is safe."
                )}
              </Text>
            </View>
          )}

          <View>
            <Pressable
              style={[styles.cta, (!file || busy) && styles.ctaDisabled]}
              onPress={handleImport}
              disabled={!file || busy}
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.primaryContent} />
                  <Text style={styles.ctaText}>{t("Importing…")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.primaryContent} />
                  <Text style={styles.ctaText}>{t("Start import")}</Text>
                </>
              )}
            </Pressable>
            {busy && (
              <Pressable style={styles.cancel} onPress={() => abortRef.current?.()}>
                <Text style={styles.cancelText}>{t("Cancel")}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
