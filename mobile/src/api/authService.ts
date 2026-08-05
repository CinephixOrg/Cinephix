import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { User } from "../types";

export async function login(email: string, password: string): Promise<User> {
  const res = await API.post(API_ROUTES.AUTH.LOGIN, { email, password });
  return res.data;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ email: string }> {
  const res = await API.post(API_ROUTES.AUTH.REGISTER, {
    username,
    email,
    password,
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
