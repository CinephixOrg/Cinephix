import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { PersonalActivityResult } from "../types";
import type { ActivityFilters } from "../utils/personalActivity";

/** One page of your own activity, for a time range and (optionally) some activity types. */
export async function getMyActivity(filters: ActivityFilters, page = 1, limit = 20): Promise<PersonalActivityResult> {
  const res = await API.get(API_ROUTES.MY_ACTIVITY.GET, {
    params: {
      range: filters.range,
      page,
      limit,
      ...(filters.categories.length > 0 ? { categories: filters.categories.join(",") } : {}),
    },
  });
  return res.data;
}
