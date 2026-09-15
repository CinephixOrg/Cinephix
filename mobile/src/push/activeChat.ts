import type { ActiveChat } from "../utils/pushRouting";

// The direct-message chat on screen, if any, so a push about a message in it
// doesn't also drop a banner over the conversation (usePushNotifications).

let active: ActiveChat | null = null;

/** Marks a chat as on screen; returns the function that unmarks it. */
export function setActiveChat(chat: ActiveChat): () => void {
  active = chat;
  return () => {
    if (active === chat) active = null;
  };
}

export function getActiveChat(): ActiveChat | null {
  return active;
}
