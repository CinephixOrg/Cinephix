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

### Cinematch tab
Taste-matching against other users: `POST /api/match` (discovery, filter by genre/watched-count/avg-rating) and `POST /api/match/:id/analyze` (LLM narrative comparison). New 6th bottom tab, deliberately not nested under Profile (overriding the original plan's own suggestion). "View Profile" from a match result and "Share analysis to DM" are both deliberately not built — no other-user-profile screen exists yet, and DM sharing depends on Chat (below), which shipped after Cinematch. `POST /api/match/:id` (specific-pair) and `GET /api/match/compatibility/:id` (referenced by web but no backend implementation — confirmed dead route, not a spec gap) are intentionally not used.

### Notifications
Global `NotificationContext` polls `GET /notifications/unread/count` every 10s while logged in (mirrors web — there's no socket push for the general badge on web either). A bell+badge sits in the header of every tab's root screen; the notifications list itself (`app/notifications.tsx`) is a **root-level modal route**, not duplicated per-tab like Content Detail, since it isn't reachable from inside any tab's own Stack. Tapping a notification only marks it read — no navigation — because every one of web's tap targets (DM screen, another user's profile, follow-request management) was itself unbuilt at the time; revisit once those exist.

**Navigation sharp edge hit here, worth remembering for any future root-level route**: the root `<Stack>` in `app/_layout.tsx` originally had zero explicit `<Stack.Screen>` children (fully auto-discovered). Adding just one explicit child (`notifications`) without also explicitly declaring the others broke routing entirely — the app booted straight into the modal with no way to reach anything else. Fix: once you add any explicit `Stack.Screen`, declare **all** of that Stack's screens, not just the new one.

### Chat (DMs) and Community/Groups
One global `ChatContext` (`socket.io-client`, single app-wide socket — deliberately consolidates what's two separate sockets on web into one) backs both. Auth via `io(url, {auth:{token}})`, not a header. The socket disconnects on backgrounding and reconnects+refetches on foreground (no push-notification infrastructure exists in this project, so a backgrounded socket does nothing useful anyway). Optimistic send uses a `clientTempId` reconcile pattern ported from web's `useChat.js`.

- **Chat** — new 7th tab (`app/(app)/messages/`: inbox, user-search "new" screen, conversation screen). DM only — `GET /conversations` returns DM+group rows merged with no server filter, so `conversationService.getConversations()` filters to `type==="dm"` client-side. Message pagination has its own cursor-based envelope (`{hasMore,limit,before}`), different from the `{total,page,limit,pages}` shape used everywhere else — has its own `MessagePagination` type, don't reuse the generic one. Only plain-text compose exists; `recommendation`/`analysis_share` message types render read-only if received.
- **Community/Groups** — new 8th tab (`app/(app)/community/`: directory with category chips, group detail with Chat/Members/About tabs). `ChatContext.joinRoom/leaveRoom/sendMessage` were generalized to take a `roomType: "dm" | "group"` param for this. The actual chat UI (message list, composer, pagination) was extracted into a shared `src/components/ChatRoom.tsx` used by both DM and group screens — socket room-join/leave lifecycle stays owned by each parent screen since they have genuinely different correct lifecycles (DM screens stay mounted on blur, so use `useFocusEffect`; a group's Chat tab actually mounts/unmounts with tab switches, so a plain `useEffect` is correct there). No group-creation UI — no backend endpoint for it; groups are preset/seeded. Two web bugs fixed rather than ported: web's group message pagination silently drops the cursor (no working "load older" for groups on web at all), and web's group screen reuses a stale message snapshot instead of refetching per visit.

### i18n
Full app coverage (not just web's own partial coverage) in all 12 of web's locales (en/tr/ru/ja/zh/fr/ko/ar/it/es/de/pt) via `i18next` + `react-i18next` + `expo-localization` (RN has no drop-in equivalent to web's `i18next-browser-languagedetector`, so `src/i18n/index.ts` hand-resolves: persisted override → device locale → `en` fallback, persisted via the existing `expo-secure-store`). Switcher lives in `profile/settings.tsx` (web's lives in a persistent `TopBar` dropdown; mobile has no persistent global chrome). Key convention **mirrors web exactly** — the raw English string is the key itself (`t("Movies")`, not `t("nav.movies")`) — this let ~85 already-translated keys be lifted verbatim from `frontend/src/locales/index.js`; ~94 net-new mobile-only keys were hand-authored directly rather than machine-translated (web's own translation pipeline, `@vitalets/google-translate-api`, is a flaky rate-limit-prone scraper unsuitable for bulk automated calls). **Genre names and group tags are deliberately NOT translated** — they're literal values sent to backend filter/query params; translating the display would break API matching. Don't "fix" this without checking first.

### Polish — loading skeletons
`src/components/Skeleton.tsx`: a pulsing `SkeletonBox` primitive (opacity loop via RN's built-in `Animated` API — `react-native-reanimated` isn't installed and isn't needed) plus shape-matched composites (`SkeletonRow`, `SkeletonListRow`, `SkeletonGrid`, `SkeletonPosterCard`, `SkeletonGroupCard`, `SkeletonAvatarCell`, `SkeletonProfileHeader`, `SkeletonGroupDetailHeader`, `SkeletonChatBubbles`, `SkeletonMatchResults`), swapped in for `ActivityIndicator` across every full-content-load screen. Two real gaps were filled along the way, not just re-skinned: Cinematch previously showed nothing while searching (now mirrors web's `MatchLoadingAnimation` podium+grid shape), and the Messages inbox had no loading state at all (now has one). Submit-button "action in progress" spinners were deliberately left as plain `ActivityIndicator` — skeletons are for initial content load, not action feedback. **Offline handling was not built** — see §5.

### Home tab
New 9th tab, **first position** — replaces Movies as the post-login landing screen (`app/index.tsx`'s redirect now targets `/home`, not `/movies`). Ports 3 of web's 5 homepage sections: **Popular This Week** (`GET /api/feed/popular-this-week`, global watchlist-add aggregate over the last 7 days), **For You** (`GET /api/feed/recommendations`, genre-scored off the same CineGraph fields Cinematch/Profile already read — the section title flips to "Popular Right Now" when the response's `hasPersonalization` is false, matching web's own conditional subcopy), and **Discover Lists** (`GET /api/lists/discover`, public lists — followed users' lists first, then filled with community lists). All 3 pre-existed on the backend; no backend changes.

**Deliberately not ported**: Top Picks, Popular Reviews, the Activity-feed tab, and Suggested Users — all 4 depend on **Follow/unfollow**, **written reviews**, or **viewing another user's profile**, none of which exist in mobile at all (confirmed: `userService.ts` has no `follow()`, `connections.tsx`'s followers/following list is read-only, there's no review-text concept anywhere in the mobile codebase). Building those would mean building three unrelated features first — deferred to a future "Social/Network" milestone.

Home has its **own nested Stack** (`home/_layout.tsx`, `home/content/[type]/[id].tsx`, `home/lists/[id].tsx`) rather than reusing Movies/Series/Lists' existing detail routes, per the Navigation architecture convention below — reusing another tab's route would silently switch your active tab on every card tap. This required extracting `src/screens/ListDetailScreen.tsx` out of what was previously inline in `lists/[id].tsx` (same self-contained pattern as `ContentDetailScreen.tsx`); it takes an optional `basePath` prop (`"/lists"` default, `"/home"` when opened from Home) forwarded to its own item grid's `ContentCard`s, so a list's contents stay within whichever tab's Stack opened it.

New `src/components/ContentRail.tsx` — the first horizontal poster-rail pattern in the app (everything else is a grid or vertical list) — is a generic `{title, data, renderItem}` wrapper backing all 3 sections. `src/components/DiscoverListCard.tsx` is the compact horizontal list card. The Discover Lists "from someone you follow" badge reuses the existing `t("Following")` i18n key rather than adding a new one — confirmed web's own `PublicListCard.jsx` does the same dual-context reuse.

### Navigation architecture — read this before adding new screens
**Every tab is its own nested `Stack`**, not a flat screen (`app/(app)/movies/_layout.tsx`, `series/_layout.tsx`, `watchlist/_layout.tsx`, `lists/_layout.tsx`, `profile/_layout.tsx`, `home/_layout.tsx`). This was a real bug that had to be fixed mid-build: bottom-tab navigators don't track per-tab history, so a flat shared screen's "back" always jumps to the *first* tab regardless of where you actually came from. It looked fine during early testing purely by coincidence (testing kept starting from the first tab).

The fix, and the pattern to follow for anything new: **Content Detail is duplicated as a thin route file inside every tab that links to it** (`movies/content/[type]/[id].tsx`, `series/content/[type]/[id].tsx`, `watchlist/content/[type]/[id].tsx`, `lists/content/[type]/[id].tsx`, `home/content/[type]/[id].tsx`), each just re-exporting one shared implementation (`src/screens/ContentDetailScreen.tsx`) — no logic duplication, just route registration. `ContentCard` (`src/components/ContentCard.tsx`) takes a required `basePath` prop (`"/movies" | "/series" | "/watchlist" | "/lists" | "/home"`) so it knows which tab's copy of the route to push to. **If you add a new screen that links into a shared detail view from multiple tabs, follow this same pattern** — do not add a flat cross-tab screen to `(app)/_layout.tsx` directly.

## 4. API layer conventions

`src/api/client.ts` is a single axios instance: request interceptor attaches the JWT from `expo-secure-store`, response interceptor unwraps the backend's `{success, message, data, pagination?}` envelope so callers just get `res.data` (and `res.pagination` when paginated).

**Known envelope inconsistencies in the backend** — several endpoints don't follow that envelope, and the corresponding service functions read fields directly instead of relying on the interceptor:
- Watchlist (`GET/POST/DELETE /users/me/watchlist`) returns raw `{message, watchlist}`.
- `GET /users/profile/:id` returns raw JSON on both branches (authorized and masked/private).
- Custom Lists (`GET /lists/me`, etc.) return `{lists}` / `{list}` — works fine either way since the interceptor only unwraps when it recognizes the envelope shape, otherwise passes the object through untouched, and these services read `.lists`/`.list` off whatever comes out.

Each `src/api/*.ts` file has a comment noting when this applies. **If a new endpoint's response looks wrong (extra nesting, or fields missing), check whether it's actually one of these unwrapped-envelope cases before assuming a bug.**

## 5. What's NOT built (remaining scope)

Chat, Cinematch, Community/Groups, Notifications, i18n, and a (partial) Home tab (§3) are now built — this section previously listed all of those as not-started; that's stale, kept only as a marker of what changed. What's still genuinely missing from the original web app feature set:

- **Follow/unfollow, written reviews, and viewing other users' profiles** — three unrelated features, none built at all (`userService.ts` has no `follow()`, no review-text concept exists anywhere in mobile, `connections.tsx` is read-only). These block full Home-page parity (Top Picks, Popular Reviews, Activity feed, Suggested Users — see §3) as well as Cinematch's "View Profile" and Notifications' `follow`/`follow_accepted` tap targets. Treat as one "Social/Network" milestone, not three separate ones — they're interdependent (e.g. the Activity feed needs Follow to have any content, Suggested Users' Follow button needs the follow endpoint).
- **Offline handling** — no offline detection, cached-data fallback, or queued-write retry anywhere in the app. Every screen assumes a live connection; a dropped network mid-load just surfaces as an error string. This was the other named "polish" item alongside loading skeletons (§3) and was explicitly deferred by the user as a separate future pass.
- **AI Profile Analysis, Favorites lists, TV Time/Letterboxd import, Activity Log/undo** — all explicitly scoped out of the Profile/Settings pass (see the "Out" list in that milestone's plan, not reproduced here — check git history for `docs`/planning artifacts if they were committed, otherwise this doc is now the record).
- **Google OAuth on a physical device over plain Wi-Fi (no ADB connection)**: the current Google Sign-In fix for the emulator relies on `adb reverse tcp:5000 tcp:5000` — see §7. This does *not* apply to a phone connected only via Expo Go over Wi-Fi with no USB/wireless-debugging ADB connection. That case needs a different solution (most likely: register the LAN-IP or a tunnel URL as an additional authorized redirect URI in Google Cloud Console, or switch to native Google Sign-In with server-side token verification — both are real scope, not a quick fix).

## 6. Dependencies added beyond the base Expo template

```
expo-router, expo-secure-store, expo-web-browser, expo-image-picker,
expo-font, expo-splash-screen, @expo-google-fonts/dm-sans,
@expo/vector-icons, react-native-svg, axios,
socket.io-client, i18next, react-i18next, expo-localization
```
All chosen deliberately to avoid heavier alternatives where a lighter option covered the need — e.g. `react-native-svg` + a hand-rolled donut chart instead of a full charting library; native image-picker crop UI instead of porting the web's custom cropper component. The last four were added for Chat and i18n respectively (see §3); notably `react-native-reanimated` was deliberately **not** added for the loading-skeleton polish pass — RN's built-in `Animated` API was enough for a simple opacity pulse.

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

The original roadmap here (Cinematch → Notifications → Chat → Community/Groups → i18n → polish pass) is complete, plus a user-requested Home tab (not part of the original roadmap — see §3) shipped after it. Two things remain named/scoped but not started:

- **Offline handling** (§5) — no offline detection, cached-data fallback, or queued-write retry exists anywhere. Loading skeletons (the other half of "polish") shipped; offline handling was explicitly carved out as its own follow-up pass.
- **Social/Network** (§5) — Follow/unfollow, written reviews, and other-user-profile viewing, bundled as one milestone since they're interdependent. This is now the highest-leverage remaining gap: it unblocks full Home-page parity (Top Picks, Popular Reviews, Activity feed, Suggested Users), Cinematch's "View Profile" + "Share analysis to DM", and Notifications' `follow`/`follow_accepted` tap navigation — four previously-separate deferred items that all trace back to these same three missing features.

Beyond those two, what's left is lower-leverage and more independent: the physical-device Google OAuth gap (§7), or the explicitly-scoped-out Profile features (AI Analysis, Favorites, import, Activity Log).
