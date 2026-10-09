import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { User } from "../types";

export async function login(email: string, password: string): Promise<User> {
  const res = await API.post(API_ROUTES.AUTH.LOGIN, { email, password });
  return res.data;
}

/**
 * The signed-in account as the server has it now (no token: that stays the
 * one from sign-in). AuthContext merges it into the stored user.
 */
export async function getMyAccount(): Promise<Omit<User, "token">> {
  const res = await API.get(API_ROUTES.USERS.ME);
  return res.data;
}

/** `acceptedTerms` is required by the API, not just the checkbox on screen. */
export async function register(
  username: string,
  email: string,
  password: string,
  acceptedTerms: boolean
): Promise<{ email: string }> {
  const res = await API.post(API_ROUTES.AUTH.REGISTER, {
    username,
    email,
    password,
    acceptedTerms,
  });
  return res.data;
}

export async function sendVerificationCode(email: string): Promise<void> {
  await API.post(API_ROUTES.AUTH.SEND_VERIFICATION, { email });
}

export async function verifyEmail(email: string, code: string): Promise<User> {
  const res = await API.post(API_ROUTES.AUTH.VERIFY_EMAIL, { email, code });
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await API.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await API.post(API_ROUTES.AUTH.RESET_PASSWORD, { email, code, newPassword });
}
