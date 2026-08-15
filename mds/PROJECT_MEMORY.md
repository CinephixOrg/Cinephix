# Cinephix — Project Memory

General reference for a Claude session picking up this repo cold. Not session-specific — see `SESSION_LOG_*.md` files in this same folder for dated work logs.

## What this is

Cinephix — a social movie/TV app: profiles, watchlists, ratings, CineGraphs (genre-taste visualization), a "CineMatch" compatibility/matching feature between users, group communities, DMs, and AI-generated taste analysis.

## Repo shape

npm workspaces monorepo, root `package.json` lists: `frontend`, `backend`, `mobile`, `packages/*`.

- **`backend/`** — Node/Express + Mongoose (MongoDB). REST API consumed by both `frontend/` and `mobile/`.
- **`frontend/`** — React + Vite web app. **Still actively used** — don't assume mobile-only changes are safe; check `frontend/src` before removing/changing a backend endpoint mobile no longer calls.
- **`mobile/`** — Expo Router (file-based routing) + React Native app. This is where most recent work has concentrated.
- **`mds/`** — all the loose project `.md` docs (reports, guides, session logs), moved here to keep repo root clean. Root only has `README.md`.
- **`docs/`** — a separate, smaller docs folder (e.g. `MOBILE_MIGRATION_PLAN.md`) — left alone, not merged into `mds/`.

## Mobile stack specifics

- Expo SDK 57, Expo Router, React 19, React Native 0.86.
- **No `babel.config.js`** by default — Expo's zero-config default applies unless something needs a custom Babel plugin. Only add one if genuinely required (e.g. Reanimated's Worklets plugin — see gotcha below).
- **Expo Go, not a dev client.** This project is tested via the plain Expo Go app, not a custom `expo-dev-client` build. That constrains which native modules are usable — anything requiring native code not already bundled into Expo Go for this SDK will crash at runtime with unhelpful errors (missing native bindings), not a clean "module not found."
  - **`react-native-reanimated` 4.x / `react-native-worklets` do not work in Expo Go on this SDK.** Confirmed via direct testing — no version-pinning combination fixed it. Any gesture/animation work should default to React Native core `PanResponder` + `Animated` unless the user explicitly signs off on setting up a dev-client build (`expo-dev-client` + EAS Build) first.
  - `react-native-gesture-handler` (the older `PanResponder`-adjacent library, not Reanimated's newer `Gesture` API) does work fine in Expo Go — it's a long-standing Expo Go bundled module.
- **i18n**: `react-i18next` is used everywhere — every user-facing string must go through `t(...)`. No hardcoded English strings in new UI.
- **Uppercase/casing bug class**: never use RN's `textTransform: "uppercase"` style — it applies the *device OS locale's* casing rules (e.g. a Turkish-locale device turns "i" into "İ" even for English text). Always uppercase in JS instead (`.toUpperCase()` on the string before rendering), which is locale-invariant.
- **Tier system**: `User.accountTier` is `"free" | "pro" | "premium" | "dev"`. Tier limits/gates live in `backend/config/tiers.js` (`TIER_LIMITS`, `getTierLimits()`) — single source of truth, extend that file rather than hardcoding limit numbers in controllers. `"dev"` is an internal testing tier (generous limits, no cooldowns), settable via a dev-only self-service endpoint surfaced in the mobile Settings screen.
- **Sub-tab pattern**: established on the own-profile page (`(app)/profile/index.tsx`) and reused since (public profile, Social tab) — a Letterboxd-style flat underlined tab row, with each tab's content **fully unmounted** when inactive (conditional render, not just hidden), not a swipeable pager.
- **CineMatch scoring**: `backend/controllers/matchController.js`'s `computeMatchBreakdown()` is the single shared scoring function for match percentage + breakdown between two specific users — used by `getMatchWithUser`, `analyzeMatchWithUser`, and `getSwipeQueue`. Don't write a new inline copy; extend this one. (The legacy grid endpoint `findMatches`, used only by `frontend/`, still uses an older separate function `scoreHybridCandidate` — intentionally not unified, since unifying it risks changing web-visible behavior without being able to test the web app from here.)

## LLM / AI features

Two independent LLM integrations, don't assume they share config:

1. **Profile Analysis** (`userController.js`) — calls Gemini directly via raw `fetch`, gated on `GEMINI_API_KEY`. Falls back to a local deterministic mock generator if the key is missing or the call fails.
2. **CineMatch "Analyze"** (`matchController.js` → `services/llmAdapter.js`) — supports `gemini` / `groq` / `openrouter` / `openai` / `mock`. Provider selection is a real fallback *chain* now (tries each configured provider in order, catches failures, moves to the next, mock is the guaranteed-last-resort).

**Gemini model name**: use `gemini-flash-latest` (a self-updating alias), not a pinned version like `gemini-2.5-flash` — pinned versions on this project's key have 404'd ("no longer available to new users") within the same day they were wired up. If Gemini calls start failing, check the model name first via `GET https://generativelanguage.googleapis.com/v1beta/models?key=...` before assuming the key is bad.

Relevant env vars (`backend/.env`, see `.env.example` for the documented list): `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` — all optional, all independently fall back to mock.

## Git / repo hygiene notes

- Current working branch during recent sessions: `furkan2_temp`, remote `origin` → `github.com/furkantr18/Cinephix`.
- **`node_modules/` at repo root is not gitignored** (only `backend/node_modules/` and a couple backup paths are, per `.gitignore`) and has pre-existing tracked cruft (`node_modules/.package-lock.json`). Don't `git add -A` / `git add .` in this repo without checking `git status` first — it'll try to stage hundreds of node_modules entries. Stage specific paths.
- `frontend/.env` and `mobile/.dev-logs/` are gitignored as of 2026-08-15 (they weren't before).
- Secrets live in `backend/.env` (gitignored). Never echo env var values into command output/logs — a past session accidentally leaked a key this way via an overly-broad `grep`; check env vars with existence/length checks instead of printing them.

## Where to look for more detail

- `mds/SESSION_LOG_*.md` — dated, detailed logs of what was done and why, including dead ends (useful before repeating an approach that already failed, e.g. the Reanimated/Expo Go saga).
- `mds/CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md` — the original two-report investigation (analyze mechanism, Gemini feasibility, CineMatch algorithm breakdown, swipe-UI plan) that most of the recent CineMatch/Social work traces back to.
