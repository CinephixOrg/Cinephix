import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutAnimation, RefreshControl, StyleSheet, View, type ListRenderItem } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../src/context/AuthContext";
import { useNotifications } from "../src/context/NotificationContext";
import { useTheme } from "../src/context/ThemeContext";
import { useToast } from "../src/context/ToastContext";
import ConfirmDialog from "../src/components/settings/ConfirmDialog";
import { CollectionStateView } from "../src/components/collection/CollectionStates";
import NotificationRow, { NotificationSectionHeader } from "../src/components/notifications/NotificationRow";
import NotificationToolbar from "../src/components/notifications/NotificationToolbar";
import NotificationSkeleton from "../src/components/notifications/NotificationSkeleton";
import { useNotificationFeed } from "../src/components/notifications/useNotificationFeed";
import {
  clearAll,
  getFeed,
  loadMoreFeed,
  markAllRead,
  markRead,
  refreshFeed,
  removeNotification,
  type FeedFilter,
} from "../src/api/notificationFeedStore";
import { prefetchDestination } from "../src/api/notificationPrefetch";
import { SECTION_LABEL, buildRows, destinationFor, hrefFor, type FeedRow } from "../src/utils/notificationFeed";
import { afterTransition, type TransitionSource } from "../src/utils/afterTransition";
import type { Notification } from "../src/types";

// Removals — a swipe, Mark all read on the Unread tab, Clear all — glide the
// remaining rows into place instead of jumping.
const GLIDE = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);
const animateNextLayout = () => LayoutAnimation.configureNext(GLIDE);

// Relative times ("5m") move on while the page stays open.
const CLOCK_TICK_MS = 60_000;

const keyExtractor = (row: FeedRow) => row.key;

export default function NotificationsScreen() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  return <NotificationsContent userId={user._id} />;
}

// The Notifications page.
//
// Everything on it reads from the app-wide feed store: reopening the page
// shows the last list on the first frame and refreshes underneath, pages load
// as the list nears its end, and every action updates the list before the
// server answers (and rolls back if it refuses). See notificationFeedStore.ts.
function NotificationsContent({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { unreadCount, decrementUnreadCount, clearUnreadCount, syncUnreadCount, refreshUnreadCount } = useNotifications();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<FeedFilter>("all");
  const feed = useNotificationFeed(filter, userId);
  const allFeed = useNotificationFeed("all", userId);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Recreated on every provider render; read through refs so the callbacks
  // handed to the memoized rows keep their identity.
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;

  // ---- Loading -----------------------------------------------------------------

  const refresh = useCallback(
    (target: FeedFilter) =>
      refreshFeed(target)
        .then((count) => {
          syncUnreadCount(count);
          setFailed(false);
        })
        .catch(() => {
          // Over a list already on screen, a failed refresh isn't worth
          // replacing it with an error (the offline banner covers that).
          if (!getFeed(target)) setFailed(true);
        }),
    [syncUnreadCount]
  );

  // Set while a tap's push is under way, so a second tap on the way out
  // doesn't stack the destination twice.
  const opening = useRef(false);

  useFocusEffect(
    useCallback(() => {
      opening.current = false;
      setNow(new Date());
      refresh(filter);
      const clock = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
      return () => clearInterval(clock);
    }, [filter, refresh])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(filter).finally(() => setRefreshing(false));
  }, [filter, refresh]);

  const onEndReached = useCallback(() => {
    loadMoreFeed(filter).catch(() => {
      // Retried the next time the end of the list is reached.
    });
  }, [filter]);

  const retry = useCallback(() => {
    setFailed(false);
    refresh(filter);
  }, [filter, refresh]);

  // ---- Actions -------------------------------------------------------------------

  // Navigation first, everything else after.
  //
  // Marking the row read re-renders both feeds and every unread badge in the
  // app. Done before the push, that work shared its JS task and held the
  // transition back — the delay between tap and screen. Now the push goes out
  // on its own, the destination's data starts loading alongside it, and the
  // row turns read once the new screen has fully covered this one, where
  // nobody sees the re-render.
  const open = useCallback(
    (item: Notification) => {
      if (opening.current) return;
      const markSeen = () => {
        if (item.read) return;
        markRead(item._id);
        decrementUnreadCount(1);
      };

      const destination = destinationFor(item, userId);
      const href = hrefFor(destination);
      if (!href) {
        markSeen();
        return;
      }

      opening.current = true;
      prefetchDestination(destination);
      router.push(href as never);
      afterTransition(navigation as unknown as TransitionSource, () =>
        requestAnimationFrame(() => {
          opening.current = false;
          markSeen();
        })
      );
    },
    [router, navigation, userId, decrementUnreadCount]
  );

  const remove = useCallback(
    (item: Notification) => {
      animateNextLayout();
      if (!item.read) decrementUnreadCount(1);
      removeNotification(item).catch(() => {
        toastRef.current(tRef.current("Failed to delete notification."));
        // The row is back; so is its share of the badge.
        refreshUnreadCount();
      });
    },
    [decrementUnreadCount, refreshUnreadCount]
  );

  const onMarkAllRead = useCallback(() => {
    // On the Unread tab this empties the list.
    if (filter === "unread") animateNextLayout();
    clearUnreadCount();
    markAllRead().catch(() => {
      toastRef.current(tRef.current("Failed to mark all as read."));
      refreshUnreadCount();
    });
  }, [filter, clearUnreadCount, refreshUnreadCount]);

  const askToClear = useCallback(() => setConfirmingClear(true), []);
  const cancelClear = useCallback(() => setConfirmingClear(false), []);
  const confirmClear = useCallback(() => {
    setConfirmingClear(false);
    animateNextLayout();
    clearUnreadCount();
    clearAll().catch(() => {
      toastRef.current(tRef.current("Failed to clear notifications."));
      refreshUnreadCount();
    });
  }, [clearUnreadCount, refreshUnreadCount]);

  // ---- Rendering -------------------------------------------------------------------

  const rows = useMemo(() => (feed ? buildRows(feed.items, now) : []), [feed, now]);

  const renderItem: ListRenderItem<FeedRow> = useCallback(
    ({ item: row }) =>
      row.kind === "header" ? (
        <NotificationSectionHeader label={t(SECTION_LABEL[row.section])} />
      ) : (
        <NotificationRow item={row.item} now={now} onOpen={open} onDelete={remove} />
      ),
    [t, now, open, remove]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { paddingTop: 4, paddingBottom: 32 },
        emptyContent: { flexGrow: 1 },
        footer: { paddingVertical: 16 },
      }),
    [colors]
  );

  let body: React.ReactNode;
  if (!feed) {
    body = failed ? (
      <CollectionStateView
        icon="cloud-offline-outline"
        title={t("Failed to load notifications.")}
        text={t("Check your connection and try again.")}
        action={{ label: t("Retry"), onPress: retry }}
      />
    ) : (
      <NotificationSkeleton />
    );
  } else {
    body = (
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={rows.length === 0 ? styles.emptyContent : styles.content}
        ListEmptyComponent={
          filter === "unread" ? (
            <CollectionStateView icon="checkmark-done-outline" title={t("You're all caught up")} text={t("No unread notifications.")} />
          ) : (
            <CollectionStateView
              icon="notifications-outline"
              title={t("No notifications yet.")}
              text={t("When someone follows you, messages you or likes your shares, it shows up here.")}
            />
          )
        }
        ListFooterComponent={feed.hasMore ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <NotificationToolbar
        filter={filter}
        onChangeFilter={setFilter}
        unreadCount={unreadCount}
        canClear={(allFeed?.items.length ?? 0) > 0 || (feed?.items.length ?? 0) > 0}
        onMarkAllRead={onMarkAllRead}
        onClearAll={askToClear}
      />

      {body}

      <ConfirmDialog
        visible={confirmingClear}
        icon="trash-outline"
        title={t("Clear all notifications?")}
        message={t("This removes every notification. It can't be undone.")}
        confirmLabel={t("Clear all")}
        cancelLabel={t("Cancel")}
        danger
        emphasis="solid"
        onConfirm={confirmClear}
        onCancel={cancelClear}
      />
    </View>
  );
}
