import { clearRooms } from "./chatCache";
import { clearActivityCache, setActivityOwner } from "./personalActivityCache";
import { setCommunitiesOwner } from "./communitiesStore";
import { clearConnections } from "./connectionsCache";
import { clearMatchAnalyses } from "./matchService";
import { clearPublicCollectionCache } from "./publicCollectionCache";
import { clearPublicProfiles } from "./publicProfileCache";
import { clearSyncScores } from "./syncScoreCache";
import { setBlocked, setOfficialIds } from "./blockStore";
import { clearTickets } from "./ticketStore";

/**
 * Drops every module-level cache that holds, or depends on, the signed-in
 * account's data — called the moment someone signs out, so the next account
 * never sees the previous one's chats, scores, profiles or feeds, not even
 * for the second before its own data arrives. (The owner-keyed stores —
 * my lists, collections, notifications — already refuse to serve another
 * account's data; they're cleared here anyway where they allow it. React
 * state in the providers resets itself when the user changes.)
 */
export function resetSessionCaches() {
  clearRooms();
  clearActivityCache();
  setActivityOwner(null);
  setCommunitiesOwner(null);
  clearConnections();
  clearMatchAnalyses();
  clearPublicCollectionCache();
  clearPublicProfiles();
  clearSyncScores();
  clearTickets();
  setBlocked([]);
  setOfficialIds([]);
}
