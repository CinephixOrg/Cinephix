import { fetchPublicProfile } from "./publicProfileCache";
import { conversationPrefetch } from "./conversationService";
import { sharePrefetch } from "./shareService";
import type { NotificationDestination } from "../utils/notificationFeed";

/**
 * Starts a notification's destination loading as the tap navigates, so it
 * has the transition's head start. Each destination takes the same request
 * instead of starting its own: the profile through its bundle cache's
 * in-flight dedupe, the chat and the share through their prefetchers.
 *
 * Used by taps in the in-app feed and on push notifications alike.
 */
export function prefetchDestination(destination: NotificationDestination): void {
  switch (destination.kind) {
    case "profile":
      fetchPublicProfile(destination.userId).catch(() => {
        // The profile screen loads (and reports) on its own.
      });
      break;
    case "chat":
      conversationPrefetch.prefetch(destination.userId);
      break;
    case "share":
      sharePrefetch.prefetch(destination.shareId);
      break;
  }
}
