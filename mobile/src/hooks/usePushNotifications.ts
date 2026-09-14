import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { useRootNavigationState, useRouter } from "expo-router";
import i18next from "../i18n";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { getFeed, markRead, refreshFeed } from "../api/notificationFeedStore";
import { prefetchDestination } from "../api/notificationPrefetch";
import { destinationFor, hrefFor } from "../utils/notificationFeed";
import { isForActiveChat, isForViewer, parsePushData, toRoutable, type PushData } from "../utils/pushRouting";
import { getActiveChat } from "../push/activeChat";
import { getNotifications, registerForPush, setAppBadge, type NotificationsModule } from "../push/registration";

// Taps already routed. The launch tap is also reported by the listener on
// some platforms, and a remount (sign out, sign back in) must not replay it.
const handledResponses = new Set<string>();

let handlerInstalled = false;

// How a push is shown while the app is open: as a banner, unless it's a
// message in the chat already on screen. Installed once, on the first mount,
// before anything can arrive.
function installForegroundHandler(Notifications: NotificationsModule) {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = parsePushData(notification.request.content.data);
      const quiet = data !== null && isForActiveChat(data, getActiveChat());
      return { shouldShowBanner: !quiet, shouldShowList: !quiet, shouldPlaySound: !quiet, shouldSetBadge: true };
    },
  });
}

/**
 * Push notifications for the signed-in account, mounted once under the root
 * navigator:
 *
 *   * registers this device (asking permission once) and re-registers when
 *     the token, the language or the permission changes;
 *   * a tap, whether the app was running, in the background or not running
 *     at all, opens the same screen the notification's row in the in-app feed
 *     opens, once someone is signed in and navigation is ready;
 *   * a push arriving while the app is open refreshes the unread badge and
 *     the loaded feed;
 *   * keeps the app icon's badge equal to the unread count.
 *
 * Does nothing at all where remote push isn't available (Expo Go on Android):
 * expo-notifications is never even loaded there (see getNotifications).
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const userId = user?._id ?? null;
  const router = useRouter();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const { unreadCount, refreshUnreadCount } = useNotifications();

  // Read by the tap handler, which is subscribed once.
  const latest = useRef({ userId, navigationReady, router, refreshUnreadCount });
  latest.current = { userId, navigationReady, router, refreshUnreadCount };
  const pending = useRef<PushData | null>(null);

  const openPending = useRef(() => {
    const data = pending.current;
    const { userId: viewerId, navigationReady: ready, router: nav, refreshUnreadCount: refreshCount } = latest.current;
    // A tap that launched the app waits here for sign-in and navigation.
    if (!data || !ready || !viewerId) return;
    pending.current = null;
    if (!isForViewer(data, viewerId)) return;

    const destination = destinationFor(toRoutable(data), viewerId);
    const href = hrefFor(destination);
    if (href) {
      prefetchDestination(destination);
      // A frame's grace, so a cold start's first redirect has settled underneath.
      requestAnimationFrame(() => nav.push(href as never));
    }
    if (data.notificationId) markRead(data.notificationId).then(refreshCount);
  });

  // Taps: the one that launched the app, and every one after.
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;
    installForegroundHandler(Notifications);

    const take = (response: NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = response.notification.request.identifier;
      if (handledResponses.has(key)) return;
      handledResponses.add(key);
      Notifications.clearLastNotificationResponse();
      const data = parsePushData(response.notification.request.content.data);
      if (!data) return;
      pending.current = data;
      openPending.current();
    };
    take(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(take);
    return () => subscription.remove();
  }, []);

  // A waiting tap goes through once sign-in and navigation are ready.
  useEffect(() => {
    openPending.current();
  }, [userId, navigationReady]);

  // Registration, and keeping it current.
  useEffect(() => {
    const Notifications = getNotifications();
    if (!userId || !Notifications) return;
    const report = (error: unknown) => console.warn("Push registration failed:", (error as Error)?.message ?? error);

    registerForPush(userId, { ask: true }).catch(report);
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      registerForPush(userId, { force: true }).catch(report);
    });
    // Comes back from Settings with notifications newly allowed, or after a long pause.
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") registerForPush(userId).catch(() => {});
    });
    // Pushes are written in the app's language.
    const onLanguageChanged = () => {
      registerForPush(userId).catch(() => {});
    };
    i18next.on("languageChanged", onLanguageChanged);

    return () => {
      tokenSubscription.remove();
      appStateSubscription.remove();
      i18next.off("languageChanged", onLanguageChanged);
    };
  }, [userId]);

  // A push while the app is open: the badge and any loaded feed catch up.
  useEffect(() => {
    const Notifications = getNotifications();
    if (!userId || !Notifications) return;
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (!parsePushData(notification.request.content.data)) return;
      refreshUnreadCount();
      for (const filter of ["all", "unread"] as const) {
        if (getFeed(filter)) refreshFeed(filter).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [userId, refreshUnreadCount]);

  // The app icon's badge is the unread count; nothing when signed out.
  useEffect(() => {
    setAppBadge(userId ? unreadCount : 0);
  }, [userId, unreadCount]);
}

/** Renders nothing; mounts usePushNotifications inside the navigator. */
export function PushNotificationsBridge() {
  usePushNotifications();
  return null;
}
