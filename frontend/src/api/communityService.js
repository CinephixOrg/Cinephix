import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem } from './cacheService';

const CACHE = {
  ALL_GROUPS: 'groups:all',
  GROUP: (slug) => `group:${slug}`,
  MEMBERS: (slug) => `group-members:${slug}`,
};

const TWO_MIN = 2 * 60 * 1000;
const THREE_MIN = 3 * 60 * 1000;

const getAllGroups = async () => {
  const cached = getCacheItem(CACHE.ALL_GROUPS);
  if (cached) return cached;
  const { data } = await API.get(API_ROUTES.GROUPS.GET_ALL);
  setCacheItem(CACHE.ALL_GROUPS, data, TWO_MIN);
  return data;
};

const getGroupBySlug = async (slug) => {
  const cached = getCacheItem(CACHE.GROUP(slug));
  if (cached) return cached;
  const { data } = await API.get(API_ROUTES.GROUPS.GET_BY_SLUG(slug));
  setCacheItem(CACHE.GROUP(slug), data, TWO_MIN);
  return data;
};

const joinGroup = async (slug) => {
  await API.post(API_ROUTES.GROUPS.JOIN(slug));
  clearCacheItem(CACHE.ALL_GROUPS);
  clearCacheItem(CACHE.GROUP(slug));
};

const leaveGroup = async (slug) => {
  await API.post(API_ROUTES.GROUPS.LEAVE(slug));
  clearCacheItem(CACHE.ALL_GROUPS);
  clearCacheItem(CACHE.GROUP(slug));
};

const getMembers = async (slug) => {
  const cached = getCacheItem(CACHE.MEMBERS(slug));
  if (cached) return cached;
  const { data } = await API.get(API_ROUTES.GROUPS.GET_MEMBERS(slug));
  setCacheItem(CACHE.MEMBERS(slug), data, THREE_MIN);
  return data;
};

// Messages are never cached — always fetched fresh for the initial load
const getMessages = async (slug) => {
  const { data } = await API.get(API_ROUTES.GROUPS.GET_MESSAGES(slug));
  return data;
};

const communityService = {
  getAllGroups,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  getMembers,
  getMessages,
};

export default communityService;
