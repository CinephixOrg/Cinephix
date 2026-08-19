import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { PersonalActivityResult } from "../types";

export async function getMyActivity(
  range: "week" | "month",
  page = 1,
  limit = 10
): Promise<PersonalActivityResult> {
  const res = await API.get(API_ROUTES.MY_ACTIVITY.GET, { params: { range, page, limit } });
  return res.data;
}
