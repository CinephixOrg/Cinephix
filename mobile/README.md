# Cinephix Mobile — Handoff / Status Document

This document exists so a second developer (and their AI assistant) can pick up this codebase cold and understand what exists, why it's built the way it is, and what's left. It reflects the actual state of the code as of this write-up — read it alongside the code, not instead of it.

## 1. What this is

A React Native (Expo) port of the Cinephix web app (`frontend/`), talking to the same backend (`backend/`, Express + MongoDB) — no backend changes were needed except two small additions for mobile Google Sign-In (see §7). The web app is the source of truth for behavior; this app mirrors it feature-by-feature rather than reinventing anything.

**Stack**: Expo SDK 57, Expo Router (file-based routing), TypeScript, plain `StyleSheet` (no NativeWind/Tailwind — see §8 for why), `expo-secure-store` for auth, `axios` for API calls.

**Not started from a prior attempt**: an earlier AI-assisted attempt at this port existed but never produced working code — everything in `mobile/` today was built fresh in this session, verified against the real backend on a physical Android emulator.

## 2. Prerequisites & running it

- Node + npm, Android Studio (for the emulator) or a physical Android phone with Expo Go installed.
- `backend/.env` must be filled in (Mongo URI, JWT secret, Cloudinary, Google OAuth client ID/secret — see `backend/.env.example`).
- `mobile/.env` (gitignored — copy from `mobile/.env.example`):
  ```
  EXPO_PUBLIC_API_BASE_URL=http://<value>:5000/api
  ```
  **This value depends on how you're testing** — this trips people up:
  - Physical phone (same Wi-Fi as your PC): your PC's LAN IP, e.g. `http://192.168.1.105:5000/api` (find via `ipconfig`).
  - Android Studio emulator: `http://10.0.2.2:5000/api` — the emulator's special alias for "the host machine." `localhost` from *inside* the emulator refers to the emulator itself, not your PC.
  - Env vars are read once when `expo start` boots — changing `.env` requires restarting the dev server, not just reloading the app.

**To run**:
```
# terminal 1
cd backend && npm run dev
# terminal 2
cd mobile && npx expo start
```
Press `a` to launch on a connected emulator, or scan the QR with Expo Go on a physical phone (same Wi-Fi). If you add/change a native dependency, restart with `npx expo start --clear` (stale Metro cache is a common source of confusing "unable to resolve module" errors right after `npm install`).

**Windows npm quirk**: `npx expo install <pkg>` sometimes fails with an `ERESOLVE` peer-dependency conflict caused by `expo-router`'s optional web-target dependencies (`@radix-ui/*` via `vaul`) — unrelated to whatever you're installing. Workaround: `npm install <pkg>@<expo-recommended-version> --legacy-peer-deps`. This has been consistently reproducible, not a one-off.

## 3. What's built (functionally complete, tested on-device)

### Auth
- Email/password: register → verify-email (6-digit code) → login. Token stored in `expo-secure-store`, not `localStorage` (mobile equivalent).
- Google Sign-In: in-app-browser OAuth flow reusing the backend's existing Passport setup (see §7 — this took real debugging, read it before touching auth).

### Movies / Series tabs
Infinite-scroll browse + search-as-you-type (via the list endpoints' `title`/`query` filter params, not the separate `/search` endpoints — those return a differently-shaped payload; using the filter param keeps one consistent shape everywhere).

### Content Detail
Poster, overview, TMDB rating, 5-star rating input (see §8 — half-star granularity matching the web widget, backed by the same 1–10 integer scale), Add-to-Watchlist toggle, Add-to-List (modal, multi-select against your lists, inline create-new-list).

### Watchlist tab
Same infinite-list pattern, pull-to-refresh.

### Lists ("Custom Lists") tab
My Lists (create/delete), List Detail (view items, owner-only edit name/description/visibility, remove item). **Not built**: the web's "Discover public lists" (web itself has no dedicated page for this either — only a homepage widget — so there was nothing to port), bulk multi-select add-from-browse (web's `AddItemsToListModal` — single-item add via Content Detail covers the core use case).

### Profile tab
View own profile (avatar, username, bio, follower/following counts — tappable, opens a list of who they are), CineGraph as an actual interactive donut chart (tap a slice or legend row to see that genre's exact count + %, not just bars — see §8), Edit Profile (bio/username, avatar via native image-picker crop UI), Settings (password change — hidden for Google accounts, privacy toggle, logout, delete account).

### Navigation architecture — read this before adding new screens
**Every tab is its own nested `Stack`**, not a flat screen (`app/(app)/movies/_layout.tsx`, `series/_layout.tsx`, `watchlist/_layout.tsx`, `lists/_layout.tsx`, `profile/_layout.tsx`). This was a real bug that had to be fixed mid-build: bottom-tab navigators don't track per-tab history, so a flat shared screen's "back" always jumps to the *first* tab regardless of where you actually came from. It looked fine during early testing purely by coincidence (testing kept starting from the first tab).

The fix, and the pattern to follow for anything new: **Content Detail is duplicated as a thin route file inside every tab that links to it** (`movies/content/[type]/[id].tsx`, `series/content/[type]/[id].tsx`, `watchlist/content/[type]/[id].tsx`, `lists/content/[type]/[id].tsx`), each just re-exporting one shared implementation (`src/screens/ContentDetailScreen.tsx`) — no logic duplication, just route registration. `ContentCard` (`src/components/ContentCard.tsx`) takes a required `basePath` prop (`"/movies" | "/series" | "/watchlist" | "/lists"`) so it knows which tab's copy of the route to push to. **If you add a new screen that links into a shared detail view from multiple tabs, follow this same pattern** — do not add a flat cross-tab screen to `(app)/_layout.tsx` directly.

## 4. API layer conventions

`src/api/client.ts` is a single axios instance: request interceptor attaches the JWT from `expo-secure-store`, response interceptor unwraps the backend's `{success, message, data, pagination?}` envelope so callers just get `res.data` (and `res.pagination` when paginated).

**Known envelope inconsistencies in the backend** — several endpoints don't follow that envelope, and the corresponding service functions read fields directly instead of relying on the interceptor:
- Watchlist (`GET/POST/DELETE /users/me/watchlist`) returns raw `{message, watchlist}`.
- `GET /users/profile/:id` returns raw JSON on both branches (authorized and masked/private).
- Custom Lists (`GET /lists/me`, etc.) return `{lists}` / `{list}` — works fine either way since the interceptor only unwraps when it recognizes the envelope shape, otherwise passes the object through untouched, and these services read `.lists`/`.list` off whatever comes out.

Each `src/api/*.ts` file has a comment noting when this applies. **If a new endpoint's response looks wrong (extra nesting, or fields missing), check whether it's actually one of these unwrapped-envelope cases before assuming a bug.**

## 5. What's NOT built (remaining scope)

From the original web app feature set, explicitly deferred:
- **Chat** (DMs + group chat) — Socket.IO-based on the backend (`backend/sockets/chatSocket.js`), room convention `group:<id>` / `dm:<id>` / `user:<id>`. Nothing mobile-side exists yet; this is the most architecturally involved remaining piece (persistent socket connection, foreground/background handling).
- **Cinematch** (taste-matching between users) — `POST /api/match`, mostly REST, no real-time complexity, but needs its own browse/match UI.
- **Community/Groups** — group browsing/joining, ties into chat for group messaging.
- **Notifications** — notification center UI.
- **AI Profile Analysis, Favorites lists, TV Time/Letterboxd import, Activity Log/undo** — all explicitly scoped out of the Profile/Settings pass (see the "Out" list in that milestone's plan, not reproduced here — check git history for `docs`/planning artifacts if they were committed, otherwise this doc is now the record).
- **Google OAuth on a physical device over plain Wi-Fi (no ADB connection)**: the current Google Sign-In fix for the emulator relies on `adb reverse tcp:5000 tcp:5000` — see §7. This does *not* apply to a phone connected only via Expo Go over Wi-Fi with no USB/wireless-debugging ADB connection. That case needs a different solution (most likely: register the LAN-IP or a tunnel URL as an additional authorized redirect URI in Google Cloud Console, or switch to native Google Sign-In with server-side token verification — both are real scope, not a quick fix).
- **i18n** (web has 12 locales via i18next) — not started.
- Viewing *other* users' profiles (only own-profile is built).

## 6. Dependencies added beyond the base Expo template

```
expo-router, expo-secure-store, expo-web-browser, expo-image-picker,
expo-font, expo-splash-screen, @expo-google-fonts/dm-sans,
@expo/vector-icons, react-native-svg, axios
```
All chosen deliberately to avoid heavier alternatives where a lighter option covered the need — e.g. `react-native-svg` + a hand-rolled donut chart instead of a full charting library; native image-picker crop UI instead of porting the web's custom cropper component.

## 7. Google Sign-In — read before touching this

This took several rounds of real debugging; the current setup is deliberate, not incidental.

**Backend** (`backend/routes/userRoute.js`, `backend/controllers/userController.js`): the existing Passport Google strategy and its registered `GOOGLE_CALLBACK_URL` (`http://localhost:5000/...`) are **completely untouched** — web login still works exactly as before. Mobile adds an *additive* path: `GET /api/users/auth/google?platform=mobile&redirectUri=<url>` threads the mobile app's own redirect URL through the OAuth `state` param (base64url-encoded JSON), and `googleAuthCallback` decodes it and redirects there instead of the web frontend, when present.

**Why not just point mobile at a fixed custom URL scheme** (`cinephix://oauth-success`)? Because **Expo Go can't register arbitrary custom URL schemes** — only a real standalone/dev-client build can. During development (Expo Go), `Linking.createURL()` produces a dynamic `exp://<lan-ip>:8081/--/oauth-success` URL instead, and the backend has to redirect to *that*, not a hardcoded scheme. This is why the redirect URL is passed explicitly by the client rather than assumed server-side (`src/api/googleAuth.ts`).

**Why the callback URL itself (`GOOGLE_CALLBACK_URL`) is NOT made dynamic per-platform**: Google's "Web application" OAuth client type flatly rejects private IPs (`192.168.x.x`) as registered redirect URIs — there's no way to register a LAN-IP callback at all. The workaround for emulator testing is `adb reverse tcp:5000 tcp:5000`, which makes the emulator's own `localhost:5000` forward to the host machine — letting mobile reuse the *exact same* already-registered `http://localhost:5000/api/users/auth/google/callback` as web, with zero Google Cloud Console changes. **This must be re-run every time the emulator restarts** (`adb reverse` doesn't persist). It does not help a physical phone with no ADB connection — see §5.

## 8. Deliberate deviations from "port the web version exactly"

- **No NativeWind/Tailwind** — plain `StyleSheet` + a shared token file (`src/theme/colors.ts`, pulled from the actual DaisyUI `forest` theme source in `frontend/node_modules/daisyui`, not guessed) + `src/theme/typography.ts` (DM Sans, matching web's font). Reasoning at the time: adding a whole styling paradigm was extra build-risk for no functional gain over tokens + StyleSheet. Worth revisiting if a developer wants to literally copy-paste `className` strings from web source going forward.
- **Star rating is 5 stars with half-star taps**, not a plain 1–10 row — matches `frontend/src/components/StarRating.jsx`'s DaisyUI `rating-half` pattern exactly (each star = 2 backend values, left half = odd, right half = even). The backend scale is still 1–10 underneath; this is purely a UI mapping.
- **CineGraph is an interactive SVG donut**, not the plain bar list it started as — matches `frontend/src/components/CineGraph.jsx`'s Chart.js Doughnut (same 8-color palette), plus tap-to-inspect since mobile has no hover for tooltips.
- **Movies/Series "search" hits the list endpoints' filter params**, not the dedicated `/search` endpoints — those return a different response shape (`posterUrl`/`releaseYear` vs `poster_path`/`release_date`) that would've required two data shapes in the UI for no benefit.

## 9. Suggested next steps

In rough order of what's likely most valuable next: Cinematch (self-contained, REST-only, no new architecture needed) → Notifications (probably needed before Chat is useful) → Chat (biggest lift — persistent socket, foreground/background lifecycle, message history pagination) → Community/Groups (depends on Chat's room model) → i18n → polish pass (loading skeletons, offline handling, etc., none of which exist yet — every screen currently just shows a spinner or an error string).
