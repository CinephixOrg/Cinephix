# Session Log — 2026-08-15

Everything done in this session, in order. Written for a future Claude session picking this repo back up — includes gotchas, not just a changelog.

## 1. Investigation: "Analyze" mechanism + Gemini feasibility

Wrote two reports, saved as [`CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md`](./CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md):

- **Report 1**: Profile Analysis (`userController.js`) calls Gemini directly, gated on `GEMINI_API_KEY` — that var was missing from `.env` entirely, so it had been silently running on the mock fallback the whole time. CineMatch's separate "Analyze" feature (`matchController.js` → `llmAdapter.js`) had no Gemini support at all, only Groq/OpenRouter/OpenAI/mock — and was actually calling real Groq successfully (key was present).
- **Report 2**: CineMatch's match-scoring algorithm is pure statistics (cosine similarity, Pearson correlation, Jaccard overlap, social/diversity heuristics) — no ML, no persistence of who's been shown to whom. Proposed a Tinder-style swipe UI with tier-gated daily swipe limits, backed by a new `MatchDecision` collection.

User approved Report 2 for implementation; Report 1 (Gemini) was initially deprioritized, then revisited later this session (see §7).

## 2. Built the CineMatch swipe UI (Report 2)

**Backend:**
- `backend/models/MatchDecision.js` (new) — one row per swipe (never updated in place), so both "who's decided" and "swipes today" read from the same collection.
- `backend/config/tiers.js` — added `swipesPerDay`, `canUseMatchFilters`, `canViewRejectedMatches`, `REJECT_COOLDOWN_DAYS` (30d), `DEFAULT_MATCH_FILTERS`.
- `backend/controllers/matchController.js` — added `getSwipeQueue`, `swipeMatch`, `getRejectedMatches`. Swipe-accept reuses `followUser`'s exact public/private branching logic. Daily limit resets on a UTC calendar-day boundary (no per-user timezone tracked anywhere in this app).
- `backend/middleware/validation.js` + `backend/routes/matchRoute.js` — new `/match/swipe*` routes.

**Mobile:**
- `mobile/src/components/match/SwipeCardStack.tsx`, `SwipeCard.tsx`, `MatchFiltersModal.tsx`, `RejectedMatchesModal.tsx` (new).
- `mobile/app/(app)/match/index.tsx` — rewritten around the swipe stack; tier-gated filter/rejected icons.
- Deleted the old grid UI: `MatchCard.tsx`, `MatchLeaderboard.tsx`, mobile's `findMatches()` wrapper (backend `findMatches`/`getMatchWithUser` endpoints kept — **the web frontend (`frontend/`) still calls `POST /match` directly**, don't remove those).

## 3. Expo Go vs react-native-reanimated — a dead end, then a rewrite

Built the swipe gestures on `react-native-reanimated` + `react-native-gesture-handler` first. Hit a wall:

- **Reanimated 4 requires `react-native-worklets` as a separate native module.** Expo Go (the generic App/Play Store app) ships a *fixed* native binary per SDK — it does not necessarily match whatever `react-native-worklets` npm version you install, and no version-pinning trick reliably fixes this (tried 0.10.4 → mismatch error; bumped to 0.11.3 to match the reported version → different error, `installUnpackers` — `undefined is not a function`, a genuine missing native binding, not a version-string mismatch).
- Set up a full dev-client path as the "real" fix (`expo-dev-client`, `eas.json`, walked through `eas login`/`eas build`/`device:create`) — user decided not to go that route.
- **Final approach: ripped Reanimated/Worklets out entirely**, rewrote `SwipeCardStack.tsx` on React Native's core `PanResponder` + `Animated` API (zero extra native deps, guaranteed to work in plain Expo Go). Also removed `babel.config.js`, `eas.json`, `expo-dev-client`, and the `GestureHandlerRootView` wrapper in `app/_layout.tsx` — none of it is needed anymore.

**Gotcha for next time:** if a future task wants Reanimated-quality animations again, it needs a dev client build — Expo Go on this SDK cannot run it, and no amount of package-version fiddling will change that. Confirm which path the user wants *before* installing it.

**Unrelated thing found + fixed along the way:** merely importing `expo-router` was crashing Android in Expo Go, unrelated to any of the above — `expo-router`'s `Stack.Toolbar` (a native Android/iOS toolbar feature, unused by this app) transitively pulls in `@expo/ui` → `react-native-worklets` just by being in the module graph, regardless of whether `Stack.Toolbar` is ever rendered. Fixed by bumping `expo-router` 57.0.11 → 57.0.13 (latest SDK 57 patch) — resolved it.

## 4. Small bug fixes

- **Stale "Follow" button after swipe-accept**: `FollowGraphContext`'s cached `followingIds` set is only updated by the normal Follow button's code path (`useFollowState`). Swipe-accept calls a different endpoint (`/match/swipe`) and never told the cache. Fixed in `match/index.tsx`'s `handleSwipe` — calls `followGraph.applyFollow()` after a successful accept, same as `useFollowState.follow()` does.
- **Duplicate "Cinematch" heading** on the swipe screen — the Stack header already showed it; removed the redundant in-body `<Text>`.
- **`seedGroups.js`** — was "insert if collection is empty," meaning adding new preset groups later would never reach an already-seeded DB. Changed to per-slug upsert (`$setOnInsert`), and added 10 more preset communities (20 total).

## 5. Merged Community + Messages into one "Social" tab

Bottom tab bar had 9 tabs including separate `community` and `messages`. Merged into one `social` tab with two in-page sub-tabs (same pattern as Profile's sub-tabs — full unmount when switching, not just hidden):

- `mobile/app/(app)/social/` replaces `community/` and `messages/` entirely — `index.tsx` (new, holds the sub-tab switcher + dynamic header via `navigation.setOptions()`), `_layout.tsx`, and the old `[slug].tsx` / `[conversationId].tsx` / `new.tsx` / `recommend.tsx` / `content/[type]/[id].tsx` moved in unchanged (same relative import depth, so no path rewrites needed beyond internal route-string references).
- `src/components/social/CommunityTab.tsx` / `MessagesTab.tsx` (new) — extracted list bodies. Added a "My Communities" filter chip (`joined` — client-side filter on `group.isMember`, not a new category).
- Updated every `/community/...` and `/messages/...` route reference app-wide (notifications, recommendation cards, group rows) to `/social/...`.

## 6. Public profile page — same sub-tab redesign as own profile

`app/user/[id]/index.tsx` now has the same Letterboxd-style tab row as `(app)/profile/index.tsx`, but **only Profile + Cinegraphs** (no Lists/Analyses — no public equivalent exists).

**Important:** did *not* reuse `ProfileOverviewTab` (own-profile's Profile tab) here — that component calls `getWatchlist()`/`getToWatchList()`/`getFeed()`, which are always current-user-scoped on the backend (no `userId` param support), and has an editable-favorites flow. Reusing it on a public profile would've shown *your* watchlist while viewing *someone else's* page, and "editing" their favorites would've silently edited yours. Built `PublicProfileOverviewTab.tsx` instead — read-only, favorites-only, matches what the backend actually supports for another user.

`ProfileCinegraphsTab.tsx` gained an `isAuthorized` guard (own profile is always authorized so this is a no-op there; public profile can be masked for private accounts).

## 7. CineMatch score consistency + Gemini (revisited Report 1)

User found the CineMatch score on the swipe screen didn't respond to genre filters, while the same filter on a public profile page changed it a lot (40% → 55%).

**Root cause, round 1**: `analyzeMatchWithUser` had its own *third* scoring formula (simplified, social/diversity/bonus hardcoded to 50) — different from `getMatchWithUser`'s full weighted one. Fixed by extracting `computeMatchBreakdown()` in `matchController.js`, used by both endpoints. Also made `analyzeMatchWithUser` accept the same filters the client used for the match call, and mobile now always sends the same filters to both.

**Root cause, round 2** (the actual swipe-screen bug): `getSwipeQueue` was *still* using the old `scoreHybridCandidate` (built for the legacy grid `findMatches` endpoint) — its dominant 35%-weighted term is Pearson correlation computed over *all* ratings, genre-filter-blind; only its minor 15% "genre affinity" term respected the filter. `computeMatchBreakdown` (what the profile page uses) genre-filters its *entire* 35% collaborative term. Switched `getSwipeQueue` onto `computeMatchBreakdown` too. **All three match-facing endpoints now share one scoring function** — don't let a fourth copy sneak in later. `scoreHybridCandidate` is still used by the legacy `findMatches` grid endpoint only (web frontend dependency, intentionally untouched).

**UI polish** (same request): removed the standalone "⚙️ Filters" button on the public profile page, replaced with a small icon next to "🎬 Cinematch" that opens the same `MatchFiltersModal` the swipe screen uses. Redesigned the match-result display into a proper card (ring + score + full-width "✨ Analyze Compatibility" button, was a bare ring + thin outlined button).

**Gemini**: added a `callGemini()` provider to `llmAdapter.js`. `analyzeMatchWithUser`'s provider selection is now a real fallback *chain* (tries Gemini → Groq → OpenRouter → OpenAI → mock in order, catching failures and moving to the next), not a single pick-and-fail choice like before.

**Model name gotcha**: originally wired up `gemini-2.5-flash`. When the user added their real `GEMINI_API_KEY`, live-tested it directly against the API (never printed the key) and got a 404 — `"This model ... is no longer available to new users"`. Listed available models for that key and confirmed `gemini-flash-latest` (a self-updating alias) works. **Use `gemini-flash-latest`, not a pinned version** — Google is retiring specific Gemini versions faster than expected; the alias avoids re-breaking this.

Also fixed: `AnalyzeModal.tsx`'s Share/Close buttons were in the opposite order from `ProfileAnalysisModal.tsx`. Both now: Share left, Close right.

## 8. Housekeeping (this task)

- Moved 23 loose root-level `.md` report files into `mds/` (this file's directory) — root now only has `README.md`. Left `docs/MOBILE_MIGRATION_PLAN.md` alone (already its own tidy folder).
- Added `frontend/.env` and `mobile/.dev-logs/` to `.gitignore` (neither was ignored before; found while checking what to stage — not committing dev logs or a second `.env`).
- **Did NOT stage `node_modules/`** despite `git status` showing hundreds of changed entries under it — the root `node_modules/` is not gitignored (only `backend/node_modules/` is) and appears to have been accidentally tracked at some point pre-dating this session (`node_modules/.package-lock.json` was already showing as modified at the very start of this session, before any work happened). Left those changes uncommitted/untouched rather than either committing repo bloat or trying to "fix" someone else's pre-existing tracking decision without being asked.

## 9. Reverted the Social tab merge (§5) — collaborator conflict

Turned out a friend/collaborator had already independently built her own version of the Community+Messages merge and was going to push it in a few days — pushing mine first would've caused a conflict neither version needed. Reverted §5 only:

- Deleted `mobile/app/(app)/social/` entirely (`index.tsx`, `_layout.tsx`) and `mobile/src/components/social/` (`CommunityTab.tsx`, `MessagesTab.tsx`).
- Recreated `mobile/app/(app)/community/{index,_layout}.tsx` and `mobile/app/(app)/messages/{index,_layout}.tsx` with their exact original (pre-merge) content — moved `[slug].tsx`, `[conversationId].tsx`, `new.tsx`, `recommend.tsx`, `content/[type]/[id].tsx` back from `social/` to their original `community/`/`messages/` locations (git detected these as renames, confirming the reconstruction matched byte-for-byte where it should).
- Restored the separate `community`/`messages` bottom-tab entries in `(app)/_layout.tsx`.
- Reverted the `/social/...` route-string references back to `/messages/...` in `notifications.tsx` and `RecommendationMessageCard.tsx`.
- **Deliberately left `backend/scripts/seedGroups.js` as-is** (idempotent per-slug seeding + the 10 extra preset groups) — that's data/backend, not "the tab," and the idempotency fix is a genuine bug fix independent of which UI displays groups. CineMatch and the public-profile redesign (§6-7) were explicitly called out as good and were untouched.

**Gotcha this surfaced**: `community/`, `messages/`, and several other files (`oauth-success.tsx`, `MyListsView.tsx`, `SettingsButton.tsx`) were never actually committed to git before this session's push — they'd existed only in the working tree since an earlier, pre-compaction part of this ongoing conversation. So there was no git history to `checkout` them back from; the revert had to reconstruct the original file contents from earlier in the conversation transcript instead of from git. If something like this needs reverting again and `git log` shows no prior commit for the file, don't assume `git checkout <ref> -- <path>` will work — check first (`git ls-tree -r --name-only <ref> | grep <path>`).

## Gotchas / things to remember next session

1. **Expo Go on this project's SDK cannot run `react-native-reanimated` 4 / `react-native-worklets`.** Don't reintroduce them without first confirming the user wants a dev-client build (`expo-dev-client` + EAS). Gesture/animation work should default to `PanResponder` + core `Animated`.
2. **`computeMatchBreakdown()` in `matchController.js` is the single source of truth** for match percentage + breakdown between two users. `getMatchWithUser`, `analyzeMatchWithUser`, and `getSwipeQueue` all call it. Don't add a new inline scoring calculation for match-related features — extend or call this instead.
3. **Gemini model name**: use `gemini-flash-latest` (see `DEFAULT_GEMINI_MODEL` in `backend/services/llmAdapter.js`). Pinned versions have a track record of 404ing on this project's key within the same day they were introduced.
4. **Root `node_modules/` is untracked-but-not-gitignored** — be careful with `git add -A`/`git add .` in this repo; it'll try to stage hundreds of node_modules files. Stage specific paths.
5. `frontend/.env` and `mobile/.dev-logs/` are now gitignored — if either reappears in `git status`, something's overriding or the ignore rule needs revisiting.
6. The web frontend (`frontend/`) still calls the legacy `POST /match` (`findMatches`) and `scoreHybridCandidate` — don't remove either while `frontend/` is still in use.
7. `mds/PROJECT_MEMORY.md` (same folder as this file) has the general, not-session-specific project reference.
8. **Community and Messages are two separate tabs again, not merged.** A collaborator is independently building her own Community+Messages merge to push separately in a few days. Don't redo the Social-tab merge (§5/§9 above) without checking whether her version has already landed.
