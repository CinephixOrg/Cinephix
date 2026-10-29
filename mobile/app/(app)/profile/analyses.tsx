import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AnalysisHistoryCard from "../../../src/components/profile/AnalysisHistoryCard";
import PaginationControls from "../../../src/components/PaginationControls";
import PageSizeDropdown from "../../../src/components/PageSizeDropdown";
import { getProfileAnalysisHistory } from "../../../src/api/userService";
import { setPendingProfileAnalysis } from "../../../src/utils/pendingProfileAnalysis";
import type { ProfileAnalysisHistoryEntry } from "../../../src/types";
import { useTheme } from "../../../src/context/ThemeContext";

// The relocated "Your Analyses" list — direct ask, moved out of the
// removed Analyze tab into its own page, reached via the profile drawer's
// "My Analyses" entry. Same card/pagination design as before
// (AnalysisHistoryCard.tsx, PaginationControls.tsx, PageSizeDropdown.tsx),
// just relocated; tapping a card stages its data the same way
// AnalyzeInfoModal.tsx does for a fresh analysis and opens the same
// full-screen story (app/(app)/profile/analyze-story.tsx).
export default function ProfileAnalysesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100, paddingHorizontal: 20, paddingTop: 16 },
        headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 },
        loadingWrap: { paddingTop: 40, alignItems: "center" },
        empty: { color: colors.placeholder, fontSize: 13, textAlign: "center", marginTop: 24 },
      }),
    [colors]
  );

  const [history, setHistory] = useState<ProfileAnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const loadHistory = async (pageNum: number, size: number) => {
    setLoading(true);
    try {
      const { items, pagination } = await getProfileAnalysisHistory(pageNum, size);
      setHistory(items);
      setTotalPages(Math.max(1, pagination.pages));
    } catch {
      // Best-effort — same as the old tab, nothing else depends on this.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    loadHistory(nextPage, pageSize);
  };

  const handlePageSizeChange = (size: number) => {
    if (size === pageSize) return;
    setPageSize(size);
    setPage(1);
    loadHistory(1, size);
  };

  const handleOpenEntry = (entry: ProfileAnalysisHistoryEntry) => {
    setPendingProfileAnalysis({ ...entry.result, tier: entry.tier, stats: entry.stats });
    router.push("/profile/analyze-story" as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <PageSizeDropdown value={pageSize} onChange={handlePageSizeChange} />
      </View>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : history.length === 0 ? (
        <Text style={styles.empty}>{t("Your past analyses will show up here.")}</Text>
      ) : (
        <>
          {history.map((entry) => (
            <AnalysisHistoryCard key={entry._id} entry={entry} onPress={() => handleOpenEntry(entry)} />
          ))}
          <PaginationControls page={page} pages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </View>
  );
}
