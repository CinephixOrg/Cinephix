import crypto from "crypto";

function shortHash(id) {
  if (!id) return null;
  const s = typeof id === 'string' ? id : String(id);
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}

/**
 * Sanitize LLM input payload by masking IDs and removing profile picture URLs.
 * Options:
 *  - redactUsernames: boolean (default false) if true, replace usernames with 'user_<hash>'
 */
export function sanitizeForLLM(payload = {}, opts = {}) {
  const { redactUsernames = false, redactProfilePic = true } = opts;

  // Deep clone minimal way (payload expected to be JSON-serializable)
  const clone = JSON.parse(JSON.stringify(payload));

  if (clone.requester) {
    if (clone.requester._id) clone.requester._id = shortHash(clone.requester._id);
    if (redactUsernames && clone.requester.username) clone.requester.username = `user_${shortHash(clone.requester.username)}`;
    if (redactProfilePic && clone.requester.profile_pic_url) clone.requester.profile_pic_url = 'REDACTED';
  }

  if (clone.target) {
    if (clone.target._id) clone.target._id = shortHash(clone.target._id);
    if (redactUsernames && clone.target.username) clone.target.username = `user_${shortHash(clone.target.username)}`;
    if (redactProfilePic && clone.target.profile_pic_url) clone.target.profile_pic_url = 'REDACTED';
  }

  // Favorites: hash ids
  if (clone.favorites) {
    if (Array.isArray(clone.favorites.me)) clone.favorites.me = clone.favorites.me.map((id) => shortHash(id));
    if (Array.isArray(clone.favorites.target)) clone.favorites.target = clone.favorites.target.map((id) => shortHash(id));
  }

  if (clone.favorites_overlap && Array.isArray(clone.favorites_overlap.intersection_ids)) {
    clone.favorites_overlap.intersection_ids = clone.favorites_overlap.intersection_ids.map((id) => shortHash(id));
  }

  // raw graphs are non-PII (genre counts) but ensure no embedded object ids
  // remove any unexpected _id fields inside graphs
  const scrubGraph = (g) => {
    if (!g || typeof g !== 'object') return g;
    const out = {};
    for (const [k, v] of Object.entries(g)) {
      if (v && typeof v === 'object') {
        const { count, avgRating } = v;
        out[k] = { count: count || 0, avgRating: avgRating || 0 };
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  if (clone.raw) {
    if (clone.raw.myGraph) clone.raw.myGraph = scrubGraph(clone.raw.myGraph);
    if (clone.raw.targetGraph) clone.raw.targetGraph = scrubGraph(clone.raw.targetGraph);
  }

  return clone;
}

export default { sanitizeForLLM };
