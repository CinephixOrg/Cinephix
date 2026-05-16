import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

// No caching for DMs — always fresh

const getConversations = async () => {
  const { data } = await API.get(API_ROUTES.CONVERSATIONS.GET_ALL);
  return data;
};

const getOrCreateConversation = async (participantId) => {
  // Ensure it's always a plain string — JSON.stringify silently drops undefined
  const { data } = await API.post(API_ROUTES.CONVERSATIONS.GET_OR_CREATE, {
    participantId: String(participantId),
  });
  return data;
};

const getMessages = async (conversationId) => {
  const { data } = await API.get(
    API_ROUTES.CONVERSATIONS.GET_MESSAGES(conversationId)
  );
  return data;
};

const markAsRead = async (conversationId) => {
  await API.post(API_ROUTES.CONVERSATIONS.MARK_READ(conversationId));
};

const sendMessage = async (conversationId, messageData) => {
  const { data } = await API.post(
    API_ROUTES.CONVERSATIONS.SEND_MESSAGE(conversationId),
    messageData
  );
  return data;
};

const dmService = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  markAsRead,
  sendMessage,
};

export default dmService;
