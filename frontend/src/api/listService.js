import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem, CACHE_KEYS } from './cacheService';

export const listService = {
  discoverLists: async (limit = 20) => {
    const res = await API.get(API_ROUTES.LISTS.DISCOVER, { params: { limit } });
    return res.data;
  },

  getMyLists: async () => {
    const cached = getCacheItem(CACHE_KEYS.MY_LISTS);
    if (cached) return cached;
    const res = await API.get(API_ROUTES.LISTS.GET_MY_LISTS);
    setCacheItem(CACHE_KEYS.MY_LISTS, res.data, 5 * 60 * 1000);
    return res.data;
  },

  createList: async ({ name, description, isPublic }) => {
    const res = await API.post(API_ROUTES.LISTS.CREATE, { name, description, isPublic });
    clearCacheItem(CACHE_KEYS.MY_LISTS);
    return res.data;
  },

  getListById: async (id) => {
    const cached = getCacheItem(CACHE_KEYS.LIST(id));
    if (cached) return cached;
    const res = await API.get(API_ROUTES.LISTS.GET_BY_ID(id));
    setCacheItem(CACHE_KEYS.LIST(id), res.data, 3 * 60 * 1000);
    return res.data;
  },

  updateList: async (id, updates) => {
    const res = await API.patch(API_ROUTES.LISTS.UPDATE(id), updates);
    clearCacheItem(CACHE_KEYS.MY_LISTS);
    clearCacheItem(CACHE_KEYS.LIST(id));
    return res.data;
  },

  deleteList: async (id) => {
    const res = await API.delete(API_ROUTES.LISTS.DELETE(id));
    clearCacheItem(CACHE_KEYS.MY_LISTS);
    clearCacheItem(CACHE_KEYS.LIST(id));
    return res.data;
  },

  addItem: async (listId, itemId, itemType) => {
    const res = await API.post(API_ROUTES.LISTS.ADD_ITEM(listId), { itemId, itemType });
    clearCacheItem(CACHE_KEYS.LIST(listId));
    return res.data;
  },

  removeItem: async (listId, itemId, itemType) => {
    const res = await API.delete(
      `${API_ROUTES.LISTS.REMOVE_ITEM(listId, itemId)}?itemType=${itemType}`
    );
    clearCacheItem(CACHE_KEYS.LIST(listId));
    return res.data;
  },
};

export default listService;
