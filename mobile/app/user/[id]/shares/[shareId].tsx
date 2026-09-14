import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import ShareCard from "../../../../src/components/ShareCard";
import { CollectionStateView } from "../../../../src/components/collection/CollectionStates";
import { sharePrefetch, toggleShareLike } from "../../../../src/api/shareService";
import { useTheme } from "../../../../src/context/ThemeContext";
import type { Share } from "../../../../src/types";

type Status = "loading" | "ready" | "missing" | "error";

// One share on its own page — what a "liked your share" notification opens.
//
// Nested under the author's profile stack (user/[id]) so the card's own links
// (a title, a list) open in that same stack, and Back returns to wherever the
// page was opened from.
export default function SharePage() {
  const { id, shareId } = useLocalSearchParams<{ id: string; shareId: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [share, setShare] = useState<Share | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const shareRef = useRef(share);
  shareRef.current = share;

  const load = useCallback(async () => {
    try {
      // The first load picks up the request the notification tap already
      // started; a refresh or retry after it finds nothing to take and
      // fetches.
      setShare(await sharePrefetch.take(shareId));
      setStatus("ready");
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Deleted since the notification was sent.
        setShare(null);
        setStatus("missing");
      } else {
        // A failed refresh leaves a share already on screen in place.
        setStatus((current) => (current === "ready" ? current : "error"));
      }
    }
  }, [shareId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    load();
  }, [load]);

  // Optimistic and rolled back if the server refuses, the same as the share lists.
  const onToggleLike = useCallback(async () => {
    const previous = shareRef.current;
    if (!previous) return;
    setShare({
      ...previous,
      liked: !previous.liked,
      likeCount: previous.liked ? Math.max(0, previous.likeCount - 1) : previous.likeCount + 1,
    });
    try {
      await toggleShareLike(previous._id);
    } catch {
      setShare(previous);
    }
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        centered: { alignItems: "center", justifyContent: "center" },
        // The share lists' own horizontal padding — ShareCard's full-bleed
        // poster is negative-margined by exactly this.
        content: { paddingHorizontal: 16, paddingVertical: 16 },
      }),
    [colors]
  );

  if (status === "loading") {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === "missing") {
    return (
      <View style={styles.screen}>
        <CollectionStateView icon="trash-outline" title={t("This share is no longer available.")} />
      </View>
    );
  }

  if (status === "error" || !share) {
    return (
      <View style={styles.screen}>
        <CollectionStateView
          icon="cloud-offline-outline"
          title={t("Failed to load share.")}
          text={t("Check your connection and try again.")}
          action={{ label: t("Retry"), onPress: retry }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ShareCard share={share} onToggleLike={onToggleLike} basePath={`/user/${id}`} />
    </ScrollView>
  );
}
