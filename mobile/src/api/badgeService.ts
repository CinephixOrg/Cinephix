import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ActivityBadgeResponse, GenreBadgesResponse, VolumeBadgesResponse } from "../types";

export async function getGenreBadges(): Promise<GenreBadgesResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_GENRE_BADGES);
  return res.data;
}

export async function getVolumeBadges(): Promise<VolumeBadgesResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_VOLUME_BADGES);
  return res.data;
}

export async function getRatingCountBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_RATING_COUNT_BADGE);
  return res.data;
}

export async function getReviewCountBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_REVIEW_COUNT_BADGE);
  return res.data;
}

export async function getListCountBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_LIST_COUNT_BADGE);
  return res.data;
}

export async function getFollowersBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_FOLLOWERS_BADGE);
  return res.data;
}

export async function getInfluencerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_INFLUENCER_BADGE);
  return res.data;
}

export async function getPodiumBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_PODIUM_BADGE);
  return res.data;
}

export async function getFirstSyncBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_FIRST_SYNC_BADGE);
  return res.data;
}

export async function getHighMatchBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_HIGH_MATCH_BADGE);
  return res.data;
}

export async function getSyncExplorerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_SYNC_EXPLORER_BADGE);
  return res.data;
}

export async function getFoundingCinephileBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_FOUNDING_CINEPHILE_BADGE);
  return res.data;
}

export async function getMembershipBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_MEMBERSHIP_BADGE);
  return res.data;
}

export async function getStreakBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_STREAK_BADGE);
  return res.data;
}

export async function getTimeTravelerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_TIME_TRAVELER_BADGE);
  return res.data;
}

export async function getEclecticTasteBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_ECLECTIC_TASTE_BADGE);
  return res.data;
}

export async function getDayOneViewerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_DAY_ONE_VIEWER_BADGE);
  return res.data;
}

export async function getHiddenGemBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_HIDDEN_GEM_BADGE);
  return res.data;
}

export async function getPollParticipantBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_POLL_PARTICIPANT_BADGE);
  return res.data;
}

export async function getHalloweenViewerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_HALLOWEEN_VIEWER_BADGE);
  return res.data;
}

export async function getNewYearViewerBadge(): Promise<ActivityBadgeResponse> {
  const res = await API.get(API_ROUTES.BADGES.GET_NEW_YEAR_VIEWER_BADGE);
  return res.data;
}
