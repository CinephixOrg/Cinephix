import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import type * as NotificationsTypes from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import i18next from "../i18n";
import { registerPushToken, unregisterPushToken } from "../api/pushService";
import { PALETTES, DEFAULT_THEME } from "../theme/palettes";

// This device's side of push notifications: the Android channels, the
// permission prompt, the Expo push token, and telling the server about it.

export type NotificationsModule = typeof NotificationsTypes;

/** Must match PUSH_CHANNELS in backend/utils/pushMessages.js. */
export const PUSH_CHANNELS = { messages: "messages", activity: "activity" } as const;

const TOKEN_KEY = "cinephix_push_token";
const UNREGISTER_TIMEOUT_MS = 3000;

/**
 * Whether this build can receive remote pushes at all. Not in an iOS
 * simulator, and not in Expo Go on Android, which dropped remote push in
 * SDK 53: those need a development build. Everything here quietly does
 * nothing where it's unsupported.
 */
export function pushSupported(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (!Device.isDevice && Platform.OS === "ios") return false;
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

let notificationsModule: NotificationsModule | null | undefined;

/**
 * expo-notifications, loaded on first use and only where remote push works.
 *
 * Never imported at the top of a module: in Expo Go on Android, merely
 * importing it throws, and since the root layout and AuthContext both reach
 * this file, a static import took every route in the app down with it
 * ("missing the required default export"). Metro evaluates a require only
 * when it runs, so Expo Go never evaluates the module at all.
 */
export function getNotifications(): NotificationsModule | null {
  if (notificationsModule === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = pushSupported() ? (require("expo-notifications") as NotificationsModule) : null;
  }
  return notificationsModule;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

let warnedNoProject = false;

/**
 * Android shows nothing for a push whose channel doesn't exist, and since
 * Android 13 the permission prompt only appears once a channel does, so
 * these are created before asking. Re-creating updates the names to the
 * current language.
 */
async function ensureChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return;
  const lightColor = PALETTES[DEFAULT_THEME].primary;
  await Promise.all([
    Notifications.setNotificationChannelAsync(PUSH_CHANNELS.messages, {
      name: i18next.t("Messages"),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor,
      showBadge: true,
    }),
    Notifications.setNotificationChannelAsync(PUSH_CHANNELS.activity, {
      name: i18next.t("Activity"),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
      lightColor,
      showBadge: true,
    }),
  ]);
}

async function ensurePermission(Notifications: NotificationsModule, ask: boolean): Promise<boolean> {
  const allowed = (status: NotificationsTypes.NotificationPermissionsStatus) =>
    status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  const current = await Notifications.getPermissionsAsync();
  if (allowed(current)) return true;
  if (!ask || !current.canAskAgain) return false;
  return allowed(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }));
}

let registered: { userId: string; token: string; locale: string } | null = null;
let inFlight: Promise<string | null> | null = null;

/**
 * Registers this device for the signed-in account's pushes. Safe to call
 * often: it asks the server again only when the account, the token or the
 * app's language changed (or `force`). Resolves with the token, or null
 * when pushes aren't available (unsupported build, no permission).
 *
 * `ask` shows the permission prompt if it hasn't been answered yet.
 */
export function registerForPush(userId: string, options: { ask?: boolean; force?: boolean } = {}): Promise<string | null> {
  if (!inFlight) {
    inFlight = register(userId, options).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function register(userId: string, { ask = false, force = false }: { ask?: boolean; force?: boolean }): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  const id = projectId();
  if (!id) {
    if (!warnedNoProject) {
      warnedNoProject = true;
      console.warn("Push notifications are off: app.json has no extra.eas.projectId. Run `eas init` in mobile/.");
    }
    return null;
  }

  await ensureChannels(Notifications);
  if (!(await ensurePermission(Notifications, ask))) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const locale = i18next.language || "en";
  if (!force && registered?.userId === userId && registered.token === token && registered.locale === locale) return token;

  await registerPushToken({
    token,
    platform: Platform.OS as "ios" | "android",
    locale,
    deviceName: Device.modelName ?? undefined,
  });
  registered = { userId, token, locale };
  await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
  return token;
}

/**
 * On sign-out, while the session is still valid: this device stops receiving
 * the account's pushes. Never throws, and gives up after a few seconds so an
 * offline sign-out isn't held up. (If it can't reach the server, the next
 * account to sign in here takes the token over.)
 */
export async function unregisterForPush(): Promise<void> {
  const token = registered?.token ?? (await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null));
  registered = null;
  if (!token) return;
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await Promise.race([
    unregisterPushToken(token).catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
  ]);
}

export function setAppBadge(count: number): void {
  getNotifications()
    ?.setBadgeCountAsync(Math.max(0, count))
    .catch(() => {});
}
