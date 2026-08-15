# Report 1 — How "Analyze" works, and why Gemini shows nothing

There are two separate, independent LLM integrations in this codebase, and only one of them uses Gemini.

**Profile Analysis** (`Analyze Profile` on your own Profile page) — `userController.js:getProfileAnalysis` calls Gemini directly via `fetch()` against `generativelanguage.googleapis.com`, gated behind `process.env.GEMINI_API_KEY`. If that key is falsy, it silently falls back to a local deterministic mock generator (`generateMockAnalysis`) — same JSON shape, zero network call.

**CineMatch "Analyze"** (compatibility analysis on a match card) — a completely different code path, `matchController.js:analyzeMatchWithUser`, which goes through `services/llmAdapter.js`. That adapter supports `groq` / `openrouter` / `openai` / `mock` as providers — it has no Gemini support at all today.

**Why the Gemini dashboard shows nothing:** `backend/.env` has no `GEMINI_API_KEY` line at all (it has `GROQ_API_KEY`, `CLOUDINARY_*`, `EMAIL_*`, etc., but no Gemini key). So every "Analyze Profile" call has been hitting the mock fallback, never Google's servers.

Side finding, unrelated to Gemini: `GROQ_API_KEY` *is* set, so CineMatch's compatibility "Analyze" button has genuinely been calling Groq's real API this whole time — just not Gemini, and not something AI Studio would ever show since it's a different vendor.

> Note: while investigating this, a command run during the session accidentally echoed the actual `GROQ_API_KEY` value into the chat transcript. It should be rotated in the Groq console as a precaution.

## Using Gemini for CineMatch — feasible, with a scope caveat

Depends which part of CineMatch is meant:

- **The match-scoring algorithm itself** (the % that ranks up to 1,000 candidate users per search) — don't route this through Gemini. It's a batch loop over every candidate; one LLM call per candidate on every search would mean up to 1,000 Gemini calls per tap of "Find Matches" — infeasible on cost and latency, and it's currently a deterministic statistical model that doesn't need an LLM's judgment to work well.
- **The compatibility narrative** (what "Analyze" produces for one specific person) — this is a single call per user action, exactly like Profile Analysis already is. Swapping this from Groq to Gemini (or adding it as an option) is straightforward:
  1. Add `GEMINI_API_KEY` to `.env` (can reuse the same key Profile Analysis already expects).
  2. Add a `callGemini()` branch to `llmAdapter.js` (different request/response shape than the OpenAI-style ones already there, but the exact pattern already exists in `userController.js`'s Profile Analysis call — copy-adapt, not new territory).
  3. Add `gemini` to `matchController.js`'s provider-selection order.
  4. Worth doing at the same time: Profile Analysis's Gemini call currently bypasses `llmAdapter.js` entirely (hand-rolled `fetch`, no shared caching/rate-limiting). Routing both features through the same adapter would unify them under one Gemini-calling code path with shared protections.
  5. `gemini-1.5-flash` (what Profile Analysis currently requests) is an older model generation — worth checking Google's current model list before wiring this up rather than assuming that name still resolves.

**Status: not being implemented right now** — deprioritized since the feature has effectively been running on the mock fallback the whole time with no real usage impact yet.

---

# Report 2 — CineMatch algorithm today, and the swipe-UI plan

## How matching actually works right now

Fully stateless and deterministic — no ML, no LLM, no persistence. Every "Find Matches" tap recomputes everything from scratch against up to 1,000 other users:

- **Collaborative filtering (35%)** — Pearson correlation on shared movie/series ratings, falling back to genre-rating similarity when there are fewer than 3 co-rated items with someone.
- **Genre affinity (15%)** — cosine similarity over CineGraph genre-count vectors.
- **Content overlap (20%)** — Jaccard-style overlap of watchlist ∪ favorites, with favorites weighted 3× a plain watchlist entry.
- **Social score (15%)** — mutual-follower/following overlap.
- **Diversity score (15%)** — how similarly "spread out" (vs. genre-concentrated) two watch histories are.

Notable quirks in the existing code:
1. `findMatches` (the list) and `getMatchWithUser` (the single-profile detail view) each reimplement this scoring inline, with different weight splits — `findMatches` has no "bonus" term despite its own doc comment claiming one, while `getMatchWithUser` adds a bonus term that's hardcoded to a constant 50%, not actually computed from anything.
2. Dedicated service modules (`contentBasedService.js`, `socialScoreService.js`, `diversityScoreService.js`, `bonusMetricsService.js`) are imported at the top of `matchController.js` but never called — the real logic lives inline instead.
3. There is no `Match` model in the database at all — nothing records who's been shown to whom, or any past decision. This is the key constraint for the swipe feature: it needs new persisted state that doesn't exist yet.

## Swipeable "flirt app" UI — plan

**Backend — new pieces needed:**
- A `MatchDecision` collection: `{ user, targetUser, contentType, decision: "accept" | "reject", createdAt }`. Once decided, exclude that target from future candidate pools for that user.
- Extend `tiers.js`'s `TIER_LIMITS` with `swipesPerDay` (e.g. free: 5, pro: 30, premium: 100, dev: 999) and `canViewRejected` (false for free, true for pro/premium) — same pattern already used for `analysisCooldownHours`.
- A daily swipe counter, tracked the same way the Profile Analysis cooldown already tracks "last run."
- New routes: `POST /api/match/swipe { targetUserId, decision }`, `GET /api/match/swipe/rejected` (pro/premium only).
- Swipe-right reuses the existing `followUser` logic as-is (`userController.js:176`) — it already branches correctly on public vs. private accounts.

**Mobile — new pieces needed:**
- A swipeable card-stack screen replacing/complementing the current grid. `react-native-gesture-handler` is already a dependency (2.32.0); `react-native-reanimated` is not currently installed and would likely be added for smooth physics-based card animations.
- A depleted-swipes state reusing the existing tier-upsell pattern already shown elsewhere in the app.
- A "Rejected" view for pro/premium, gated the same way the Analyses history tab is gated.

Net: no fundamental blocker — the missing piece is entirely persistence (no `Match` model exists today); everything else (follow logic, tier-gating pattern, cooldown-style counters, upsell UI) already has an established convention in this codebase to extend rather than invent from scratch.

**Status: approved for implementation.**
