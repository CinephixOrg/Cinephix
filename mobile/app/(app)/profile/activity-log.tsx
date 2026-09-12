import { useCallback, useState, useMemo } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "../../../src/i18n";
import {
  getActivityLogs,
  revertActivityLogs,
  resetAllData,
} from "../../../src/api/activityLogService";
import { SkeletonActivityLogRow } from "../../../src/components/Skeleton";
import type { ActivityLog, ActivityLogActionType } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";

// Module-level (not a hook), same pattern as notifications.tsx's
// getNotificationMeta — this screen's rows already use Ionicons for the
// checkbox glyph, so the type icon uses Ionicons too rather than emoji, to
// keep one icon system per row.
function getLogMeta(actionType: ActivityLogActionType): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  switch (actionType) {
    case "RATE":
      return { icon: "star", label: i18n.t("Rated content") };
    case "ADD_WATCHLIST":
      return { icon: "bookmark", label: i18n.t("Added to Watched List") };
    case "IMPORT":
      return { icon: "cloud-upload", label: i18n.t("Imported a library") };
    case "IMPORT_TVTIME":
      return { icon: "cloud-upload", label: i18n.t("Imported from TV Time") };
    case "IMPORT_LETTERBOXD":
      return { icon: "cloud-upload", label: i18n.t("Imported from Letterboxd") };
    default:
      return { icon: "time", label: i18n.t("Activity Log") };
  }
}

export default function ActivityLogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base100, padding: 20 },
  actionRow: { marginBottom: 8 },
  undoButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  undoButtonDisabled: { opacity: 0.5 },
  undoButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 15 },
  flatList: { flex: 1 },
  list: { paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  checkboxSpacer: { width: 20 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.baseContent },
  rowDetails: { fontSize: 12, color: colors.placeholder, marginTop: 1 },
  rowTimestamp: { fontSize: 11, color: colors.placeholder, marginTop: 1 },
  rowTextReverted: { textDecorationLine: "line-through", color: colors.placeholder },
  empty: { textAlign: "center", color: colors.placeholder, marginTop: 40 },
  error: { color: colors.error, textAlign: "center", marginBottom: 8 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.baseContent,
    marginTop: 16,
    marginBottom: 8,
  },
  dangerTitle: { color: colors.error },
  resetButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  resetButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 16 },
}), [colors]);
  const { t } = useTranslation();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undoing, setUndoing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const items = await getActivityLogs();
      setLogs(items);
      setSelected(new Set());
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to load activity log."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLogs().finally(() => setLoading(false));
    }, [fetchLogs])
  );

  const toggleSelect = (item: ActivityLog) => {
    if (item.isReverted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item._id)) next.delete(item._id);
      else next.add(item._id);
      return next;
    });
  };

  const handleUndoSelected = async () => {
    setUndoing(true);
    try {
      await revertActivityLogs(Array.from(selected));
      await fetchLogs();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to undo selected activity."));
    } finally {
      setUndoing(false);
    }
  };

  const handleResetAllData = () => {
    Alert.alert(
      t("Reset all data"),
      t("This permanently clears your watchlist, ratings, favorites, and activity log. This cannot be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Reset Everything"),
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await resetAllData();
              await fetchLogs();
            } catch (e: any) {
              setError(e?.response?.data?.message || t("Failed to reset data."));
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.undoButton, (selected.size === 0 || undoing) && styles.undoButtonDisabled]}
          onPress={handleUndoSelected}
          disabled={selected.size === 0 || undoing}
        >
          {undoing ? (
            <ActivityIndicator size="small" color={colors.primaryContent} />
          ) : (
            <Text style={styles.undoButtonText}>
              {t("Undo Selected")} ({selected.size})
            </Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonActivityLogRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          data={logs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = getLogMeta(item.actionType);
            const isSelected = selected.has(item._id);
            return (
              <Pressable style={styles.row} onPress={() => toggleSelect(item)}>
                {item.isReverted ? (
                  <View style={styles.checkboxSpacer} />
                ) : (
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={20}
                    color={isSelected ? colors.primary : colors.placeholder}
                  />
                )}
                <Ionicons
                  name={meta.icon}
                  size={18}
                  color={item.isReverted ? colors.placeholder : colors.baseContent}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, item.isReverted && styles.rowTextReverted]}>
                    {meta.label}
                  </Text>
                  <Text style={[styles.rowDetails, item.isReverted && styles.rowTextReverted]} numberOfLines={1}>
                    {item.details}
                  </Text>
                  <Text style={styles.rowTimestamp}>
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>{t("No recent activity.")}</Text>}
        />
      )}

      <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t("Danger Zone")}</Text>
      <Pressable style={styles.resetButton} onPress={handleResetAllData} disabled={resetting}>
        {resetting ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.resetButtonText}>{t("Reset All Data")}</Text>
        )}
      </Pressable>
    </View>
  );
}

