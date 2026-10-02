import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { FeedUserRef } from "../types";
import type { ReportEntityType, ReportReason } from "../utils/safety";

export async function blockUser(userId: string): Promise<void> {
  await API.post(API_ROUTES.USERS.BLOCK(userId));
}

export async function unblockUser(userId: string): Promise<void> {
  await API.delete(API_ROUTES.USERS.BLOCK(userId));
}

/** The people you've blocked (not who has blocked you — that stays private). */
export async function getBlockedUsers(): Promise<FeedUserRef[]> {
  const res = await API.get(API_ROUTES.USERS.BLOCKED);
  return res.data;
}

/** The official Cinephix account's id(s) — never reportable or blockable. */
export async function getOfficialIds(): Promise<string[]> {
  const res = await API.get(API_ROUTES.USERS.OFFICIAL);
  return res.data?.ids ?? [];
}

export async function reportContent(report: {
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  description?: string;
}): Promise<{ alreadyReported: boolean }> {
  const res = await API.post(API_ROUTES.REPORTS.CREATE, report);
  return { alreadyReported: Boolean(res.data?.alreadyReported) };
}
