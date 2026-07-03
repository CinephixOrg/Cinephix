/**
 * llmFormatterService.js
 *
 * Create a fixed JSON schema that summarizes the hybrid match calculation
 * so an LLM can consume it and produce a human-friendly analysis, short
 * explanation, suggested conversation openers, and a small graph dataset.
 */

export function formatForLLM({
  schema_version = "1.0",
  requester = {},
  target = {},
  type = "movie",
  cineKey = "movieCineGraph",
  matchPercentage = 0,
  breakdown = {},
  myGraph = {},
  targetGraph = {},
  favorites = { me: [], target: [] },
  socialOverlap = {},
} = {}) {
  // Top genres overlap
  const allGenres = new Set([...Object.keys(myGraph || {}), ...Object.keys(targetGraph || {})]);
  const topGenres = [...allGenres].map((g) => {
    const a = (myGraph && myGraph[g] && myGraph[g].count) || 0;
    const b = (targetGraph && targetGraph[g] && targetGraph[g].count) || 0;
    return { genre: g, me_count: a, target_count: b, total: a + b };
  }).sort((x, y) => y.total - x.total).slice(0, 10);

  // Favorites overlap
  const setA = new Set((favorites.me || []).map(String));
  const setB = new Set((favorites.target || []).map(String));
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);

  // Top shared genre / genre affinity details
  const sharedGenres = topGenres.filter((genre) => genre.me_count > 0 && genre.target_count > 0);
  const commonGenres = sharedGenres.slice(0, 5).map((genre) => ({
    genre: genre.genre,
    me_count: genre.me_count,
    target_count: genre.target_count,
    total: genre.total,
  }));
  const topSharedGenre = commonGenres[0] || null;

  // Simple graph data for LLM to draw a small chart (component breakdown)
  const graphData = {
    labels: ["Collaborative", "ContentBased", "Social", "Diversity", "Bonus"],
    values: [
      breakdown.collaborative || 0,
      breakdown.contentBased || 0,
      breakdown.social || 0,
      breakdown.diversity || 0,
      breakdown.bonus || 0,
    ],
  };

  // Compose the final LLM input payload
  return {
    schema_version,
    meta: {
      generated_at: new Date().toISOString(),
      type,
    },
    requester,
    target,
    match: {
      final_score: matchPercentage, // 0-100
      breakdown,
      graphData,
    },
    favorites_overlap: {
      intersection_count: intersection.length,
      union_count: union.size,
      intersection_ids: intersection.slice(0, 50),
    },
    social_overlap: {
      mutual_following: socialOverlap.mutualFollowing || 0,
      mutual_followers: socialOverlap.mutualFollowers || 0,
      following_overlap_rate: socialOverlap.followingOverlapRate || 0,
      followers_overlap_rate: socialOverlap.followersOverlapRate || 0,
    },
    shared_genres: {
      common_genres: commonGenres,
      top_shared_genre: topSharedGenre,
    },
    top_genres: topGenres,
    raw: {
      myGraph: Object.keys(myGraph || {}).length ? myGraph : {},
      targetGraph: Object.keys(targetGraph || {}).length ? targetGraph : {},
    },
    // A reusable prompt template the frontend/backend can send to the LLM
    prompt_template: {
      instruction: "You are an assistant that analyzes compatibility between two users based on the provided JSON data. Pay special attention to common genres, shared favorite items, and network overlap (mutual followers/following). Produce a concise analysis (max 160 words), list strengths, list potential conversation openers, and provide a short interpretation of the graph data. Also return a small ASCII-like bar representation for the five components.",
      examples: {
        short_analysis: "They have strong genre overlap and shared favorites — good match. Social overlap is low, try mentioning a shared favorite movie to start conversation.",
      },
      required_output_keys: ["analysis", "strengths", "weaknesses", "conversation_starters", "graph_ascii"],
    },
  };
}

export default { formatForLLM };
