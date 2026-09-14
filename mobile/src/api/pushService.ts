import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";

export interface PushRegistration {
  token: string;
  platform: "ios" | "android";
  /** The app's language, so the server writes this device's pushes in it. */
  locale: string;
  deviceName?: string;
}

export async function registerPushToken(registration: PushRegistration): Promise<void> {
  await API.post(API_ROUTES.USERS.PUSH_TOKENS, registration);
}

export async function unregisterPushToken(token: string): Promise<void> {
  await API.delete(API_ROUTES.USERS.PUSH_TOKEN(token));
}
