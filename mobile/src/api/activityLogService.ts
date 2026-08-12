import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ActivityLog } from "../types";

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const res = await API.get(API_ROUTES.ACTIVITY_LOG.GET_ALL);
  return res.data;
}

export async function revertActivityLogs(logIds: string[]): Promise<void> {
  await API.post(API_ROUTES.ACTIVITY_LOG.REVERT, { logIds });
}

export async function resetAllData(): Promise<void> {
  await API.post(API_ROUTES.ACTIVITY_LOG.RESET_ALL_DATA);
}
