# Cinephix Mobile Migration Plan & Architecture Document

**Document Version:** 1.3.0 (Revised per Phase 1 v1.2 Review)  
**Author:** Senior Cross-Platform Mobile Architect & React Native Engineer  
**Target Platforms:** iOS 16.0+ and **Android 10.0+ (minSdkVersion 29, targetSdkVersion 36)**  
**Status:** Approved for Phase 2 Scaffolding & Implementation

---

## 1. Executive Summary & Architecture Justification

Cinephix is evolving from a responsive web application into a production-grade, natively compiled mobile application for iOS and Android. Our foundational architectural mandate is **zero backend rewrite**: the existing Node.js/Express 5/MongoDB backend and Cloudinary/Socket.io pipelines will remain the system of record, supporting both the web application and the new mobile client simultaneously.

### 1.1 Target Technology Stack & Modern SDK Commitment (SDK 56 vs SDK 57 Justification)

We commit to **React Native via Expo SDK 56 (React Native 0.85 / React 19.2), TypeScript strict mode, built with EAS Build and Expo Development Builds**.

#### Why Expo SDK 56 over SDK 57?
While Expo SDK 57 was released roughly one month ago (July 2026) shipping React Native 0.86, we deliberately commit to **Expo SDK 56 (May 2026) with React Native 0.85 and React 19.2**. 
* **Stability & Battle-Testing:** SDK 56 has been in the wild for several months, with mature, battle-tested third-party native module compatibility across `react-native-mmkv` v3, `react-native-reanimated` v3, `expo-apple-authentication`, `@sentry/react-native` v6, and `react-native-gifted-charts`. 
* **Zero Version Friction:** Because SDK 56 ships React Native 0.85 with full **React 19.2 support**, it completely eliminates React 18 vs 19 peer dependency conflicts with our React 19 web codebase while avoiding the early-adopter native linking fragility of a 1-month-old SDK 57 release.
* **API 36 Support:** Expo SDK 56 fully supports compiling and targeting **Android API Level 36 (`targetSdkVersion 36`)**, ensuring full compliance with Google Play's August 2026 mandate while maintaining compatibility down to `minSdkVersion 29` (Android 10).

#### Development Builds vs. Expo Go DX Clarification
Because our architecture relies on custom native modules (`expo-apple-authentication`, `@react-native-google-signin/google-signin`, `react-native-mmkv` v3, `@sentry/react-native` v6, and `posthog-react-native`), **Expo Go is unusable from day one**. 
* **Development Builds DX:** We will use **Expo Prebuild & Development Builds** (`npx expo run:ios` / `npx expo run:android` / EAS dev profiles). This provides an even superior developer experience (DX) than Expo Go, maintaining full Fast Refresh, hot reloading, and source symbolication while granting unrestricted access to iOS Keychain, Android Keystore, and native OS SDKs.

---

### 1.2 Framework Selection: Expo vs. Bare React Native vs. Flutter

| Evaluation Criteria | React Native via Expo SDK 56 (Chosen) | Bare React Native | Flutter (Dart) |
| :--- | :--- | :--- | :--- |
| **Code & Business Logic Reuse** | **Highest (85%+)**. Types, Yup schemas, Axios interceptors, i18n JSONs, date helpers, and constants transfer verbatim. | **High (80%+)**. Same TS logic sharing, but requires manual native dependency linking and Xcode/Gradle build maintenance. | **Zero (0%)**. Requires rewriting all client domain logic, data models, validation rules, and API services in Dart. |
| **Modern React 19 Alignment** | **Seamless**. SDK 56 ships RN 0.85 with full React 19.2 support, eliminating all version friction with our React 19 web app. | **Moderate**. Manual upgrade paths to RN 0.85+ can cause Podfile/Gradle dependency breaks. | **N/A**. Dart ecosystem has no compatibility or shared concepts with React 19 hooks or server state. |
| **Real-time & Media Handling** | **First-Class**. Direct compatibility with existing `socket.io-client` v4, `expo-image` (caching), and `expo-image-manipulator` (cropping). | **Good**. Requires linking custom native modules for image cropping and secure storage. | **Good**. Native web sockets and image cropping exist, but requires separate Cloudinary upload implementations. |
| **Build & Deployment (EAS)** | **Turnkey**. EAS Build/Submit allows cloud compiling, OTA updates, and direct store delivery without local macOS hardware requirements. | **Manual/Complex**. Requires custom Fastlane or Bitrise pipelines for iOS/Android code signing. | **Manual/Complex**. Requires separate CI/CD pipelines (e.g., Codemagic) for Dart compilation and signing. |
| **Developer Experience** | **Fastest**. Development Builds (`npx expo run:ios`), file-based routing (Expo Router v6), Fast Refresh, and unified config (`app.config.ts`). | **Slower**. Frequent native rebuilds required when adding or modifying native modules. | **Fast**. Hot reload is excellent, but context switching between TS/Node backend and Dart client slows velocity. |

**Commitment Decision:** Expo SDK 56 is the definitive choice because it natively aligns with React 19.2, maximizing code reuse from our existing React 19 web codebase without peer dependency friction, while providing production-grade OTA updates, native media handling, and EAS push notifications out of the box.

---

### 1.3 Monorepo Architecture & Workspace Layout

We will adopt an **npm workspaces** monorepo layout. The root directory currently utilizes `package-lock.json`; formalizing npm workspaces allows us to extract a shared library package (`packages/shared`) that both `frontend` (web) and `mobile` (Expo) import as a workspace dependency (`@cinephix/shared`).

#### Folder Tree
```text
Cinephix/
├── package.json                 # Root workspace config (npm workspaces: ["frontend", "backend", "mobile", "packages/*"])
├── package-lock.json            # Unified root dependency lockfile
├── backend/                     # Existing Node.js/Express 5/MongoDB API & Socket.io server
├── frontend/                    # Existing Vite + React 19 Web Application
├── mobile/                      # [NEW] Expo SDK 56 / React Native 0.85 Mobile Application
│   ├── app/                     # Expo Router v6 file-based navigation tree (tabs, stacks, modals)
│   ├── components/              # Native UI components (NativeWind v4 styled, custom primitives)
│   ├── hooks/                   # Mobile-specific hooks (push tokens, native gestures, app state)
│   ├── app.config.ts            # Dynamic Expo config (environments, bundle IDs, permissions, LAN IP, targetSdk 36, minSdk 29)
│   └── package.json             # Mobile workspace dependencies
└── packages/
    └── shared/                  # [NEW] Shared domain layer between Web and Mobile
        ├── src/
        │   ├── api/             # Shared Axios instance, API route constants, and service layer
        │   ├── constants/       # App constants, genre definitions, layout tokens
        │   ├── i18n/            # Shared translation JSON files (en, tr, es, de, fr)
        │   ├── types/           # Shared TypeScript interfaces (User, Movie, Series, Review, DM)
        │   ├── utils/           # Date formatting, JWT parsing, similarity algorithms, validators
        │   └── validation/      # Yup schemas for Login, Register, Profile, Lists, and Reviews
        └── package.json         # Workspace package ("name": "@cinephix/shared", peerDeps: react ^19.0.0)
```

---

## 2. Web → Mobile Dependency Mapping Table (Verified Versions)

This table maps every dependency from our existing web technology stack to its exact verified target in the mobile app, ensuring strict compatibility with Expo SDK 56 and React 19.2.

| Web Dependency (Current) | Target Mobile Dependency (Verified Version) | Action | Technical Justification & Migration Notes |
| :--- | :--- | :--- | :--- |
| `react` v19.1 / `react-dom` | `react` v19.2 / `react-native` v0.85 | **Replace** | Expo SDK 56 ships React Native 0.85 with full React 19.2 support. DOM elements (`div`, `span`) are replaced with native primitives (`View`, `Text`, `Pressable`). |
| `vite` v7 | `@expo/cli` v56 / `metro` v0.80+ | **Replace** | Metro is the specialized JavaScript bundler for React Native, handling asset resolution, tree-shaking, and native bundle generation. |
| `react-router-dom` v7 | `expo-router` v6 | **Replace** | Expo Router provides file-based routing built on top of React Navigation v7, enabling native stack/tab animations, deep links, and universal URLs. |
| `tailwindcss` v3 + `daisyui` | `nativewind` v4 + Custom UI Kit | **Replace** | NativeWind v4 compiles Tailwind utility classes into native styling objects at build time. DaisyUI is DOM-bound; we will port its design tokens into a custom, hand-rolled React Native UI kit using NativeWind primitives. |
| `styled-components` v6 | `nativewind` v4 / `StyleSheet` | **Drop** | Consolidating on NativeWind eliminates runtime style calculation overhead and ensures a unified styling methodology across screens. |
| `framer-motion` v12 | `react-native-reanimated` v3.16 | **Replace** | Framer Motion relies on DOM APIs. Reanimated executes animations directly on the UI thread at 60/120fps without JavaScript bridge latency. |
| `axios` v1.12 | `axios` v1.12 (in `@cinephix/shared`) | **Keep** | Works identically in Node, Browser, and React Native. Interceptor logic will be extracted to shared code, injecting tokens from SecureStore on mobile. |
| `socket.io-client` v4.8 | `socket.io-client` v4.8 | **Keep** | Compatible with React Native WebSocket transport. Wrapped in an App-State-aware provider to handle mobile sleep, backgrounding, and reconnection. |
| `react-hook-form` v7 + `yup` | `react-hook-form` v7 + `yup` v1.7 | **Keep** | 100% headless validation logic. Forms bind directly to native `TextInput` components via RHF `Controller`. |
| `i18next` + `react-i18next` | `i18next` v26 + `react-i18next` v17 | **Keep** | Translation JSON files move to `@cinephix/shared/i18n` for identical cross-platform localization. |
| `i18next-browser-languagedetector` | `expo-localization` v16 | **Replace** | Browser detector (`window.navigator`) is swapped for `expo-localization` (`getLocales()[0].languageCode`) to detect native OS language settings. |
| `chart.js` + `react-chartjs-2` | `react-native-gifted-charts` v1.4+ | **Replace** | Chart.js renders to an HTML5 `<canvas>`. Gifted Charts renders native vector graphics with smooth 60fps animations, tooltips, and touch gestures without heavy Skia dependencies. |
| `lottie-react` v2.4 | `lottie-react-native` v6.7+ | **Replace** | Renders existing Lottie JSON animation files natively using iOS/Android CoreAnimation layers. |
| `react-easy-crop` v5.5 | `expo-image-picker` + `expo-image-manipulator` | **Replace** | Web canvas cropping is replaced by native device photo library selection, cropping, and compression before uploading to Cloudinary. |
| `react-hot-toast` v2.6 | `burnt` v0.12 / `react-native-toast-message` v2.2 | **Replace** | Burnt invokes native iOS/Android system toast/banner alerts for an authentic, native feel. |
| `emoji-picker-react` v4 | Native Keyboard / `rn-emoji-keyboard` v1.7+ | **Replace** | Mobile UX dictates using the OS native emoji keyboard by default. For custom chat emoji reactions, we use lightweight `rn-emoji-keyboard`. |
| `date-fns` v4 / `dayjs` | `date-fns` v4 | **Consolidate** | Drop `dayjs` completely across the repo to reduce bundle size and consolidate date formatting in `@cinephix/shared/utils`. |
| `jwt-decode` v4 | `jwt-decode` v4 | **Keep** | Pure JavaScript token decoding works seamlessly in React Native. |
| `localStorage` (Web API) | `expo-secure-store` v13+ / `react-native-mmkv` v3+ | **Replace** | JWTs and sensitive tokens are vaulted in encrypted Keychain (iOS) / Keystore (Android) via SecureStore. Non-sensitive preferences (theme, onboarding state) use ultra-fast synchronous `react-native-mmkv`. |
| *None* (Web Push API) | `expo-notifications` v0.28+ | **Add [NEW]** | Enables native Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM) background notifications with deep-link receipt handling. |
| *None* (Web OAuth Redirect) | `@react-native-google-signin/google-signin` v13+ | **Add [NEW]** | Triggers native OS Google Sign-In prompts, retrieving cryptographic ID tokens for direct backend verification without browser webviews. |
| *None* (Apple Sign-In) | `expo-apple-authentication` v6+ | **Add [NEW]** | Mandatory Apple Guideline 4.8 blocker. Triggers native iOS FaceID/TouchID Apple sign-in prompt and retrieves Apple identity token. |
| *None* (File/ZIP Import) | `expo-document-picker` v12+ | **Add [NEW]** | Replaces web drag-and-drop/file input for importing Letterboxd ZIP/CSV archives from iOS Files or Android SAF. |
| *None* (Crash Observability) | `@sentry/react-native` v6+ | **Add [NEW]** | Production crash reporting, native symbolication, EAS source map upload, and real-time ANR error monitoring. |
| *None* (Product Analytics) | `posthog-react-native` v3+ | **Add [NEW]** | GDPR/KVKK-compliant open-source product analytics, event tracking, feature flags, and user funnels without third-party data selling. |
| `@vitalets/google-translate-api`| Backend Proxy (`POST /api/translate`) | **Replace** | Client-side scraping/API usage is removed entirely from client bundles to prevent IP blocking and API key leakage; proxied via Express backend. |
| *None* (Client State) | `@tanstack/react-query` v5 + `zustand` v5 | **Add [NEW]** | Formalizes state management: TanStack Query v5 manages server state (caching, offline persistence), while Zustand v5 manages synchronous UI/client state. |

---

## 3. Screen-by-Screen Port Table

Every web route from `frontend/src/App.jsx` is mapped to an Expo Router file structure, native navigation layout, release priority, and mandatory automated testing criteria.

| Web Route (Current) | Mobile Route (Expo Router v6) | Navigation Pattern | Purpose & API Dependencies | Priority & DoD Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `/` (Splash/Welcome) | `app/index.tsx` | Fullscreen Stack (No Header) | Initial landing, animated logo splash, auto-redirect if authenticated. | **P1** \| *Jest Unit + Maestro E2E: Auto-routing on valid vs invalid token.* |
| `/login` | `app/(auth)/login.tsx` | Auth Stack | Email/Password, Google OAuth & Apple Sign-In. API: `POST /users/login`, ID Token auth. | **P1** \| *Maestro E2E: Login success, error toasts, OAuth/Apple native triggers.* |
| `/register` | `app/(auth)/register.tsx` | Auth Stack | User account creation with KVKK/GDPR consent toggle. API: `POST /users/register`. | **P1** \| *Jest Unit: Validation schema tests; Maestro E2E: Registration flow.* |
| `/verify-email` | `app/(auth)/verify-email.tsx` | Auth Stack | Email code verification. API: `POST /users/verify-email`, `POST /users/resend-verification`. | **P1** \| *Maestro E2E: Code submission and resend cooldown timer.* |
| `/forgot-password` | `app/(auth)/forgot-password.tsx`| Auth Stack | Password recovery initiation. API: `POST /users/forgot-password`. | **P1** \| *Jest Unit: Email format validation; E2E request trigger.* |
| `/setup-profile` | `app/(onboarding)/setup.tsx`| Modal Stack (No Dismiss) | Post-signup avatar upload and bio setup. API: `POST /profile/:id/upload-profile-pic`, `POST /profile/:id/bio`. | **P2** \| *Maestro E2E: Native image picker, cropping, Cloudinary signed upload.* |
| `/home` | `app/(tabs)/index.tsx` | Main Bottom Tab 1 | Personalized activity feed, top picks, recommendations. API: `GET /feed`, `GET /feed/top-picks`, `GET /users/me/suggestions`. | **P1** \| *Maestro E2E: Infinite scroll, pull-to-refresh, skeleton loading.* |
| `/movies` | `app/(tabs)/movies.tsx` | Main Bottom Tab 2 (Top Tabs) | Movie browsing, search, genre filtering. API: `GET /movies`, `GET /movies/search`. | **P3** \| *Jest Unit: Debounced search hook; Maestro E2E: Genre filter selection.* |
| `/series` | `app/(tabs)/series.tsx` | Main Bottom Tab 2 (Top Tabs) | TV Series browsing, search, genre filtering. API: `GET /series`, `GET /series/search`. | **P3** \| *Maestro E2E: Series search and pagination.* |
| `/match` | `app/(tabs)/match.tsx` | Main Bottom Tab 3 (Center Action) | Taste-based matching algorithms and compatibility card UI. API: `POST /match`, `GET /match/compatibility/:userId`. | **P3** \| *Maestro E2E: Swipe gesture handling, compatibility score modal.* |
| `/community` | `app/(tabs)/community/index.tsx` | Main Bottom Tab 4 (Stack) | Discover and browse discussion groups. API: `GET /groups`. | **P4** \| *Maestro E2E: Group list rendering, join/leave button state.* |
| `/community/:slug` | `app/(tabs)/community/[slug].tsx`| Push Stack (from Tab 4) | Group chat room, member list, messages. API: `GET /groups/:slug`, Socket: `join-room`, `send-message`. | **P4** \| *Maestro E2E: Real-time message dispatch, UGC Report/Block action sheet.* |
| `/dm` | `app/(tabs)/messages/index.tsx` | Main Bottom Tab 5 (Stack) | Direct conversation list. API: `GET /conversations`, Socket: `join-inbox`, `conversation-updated`. | **P4** \| *Maestro E2E: Conversation list sorting, unread badge count display.* |
| `/dm/:conversationId` | `app/(tabs)/messages/[id].tsx` | Push Stack (from Tab 5) | Private 1-on-1 chat room with emoji reactions. API: `GET /conversations/:id/messages`, Socket: `send-message`. | **P4** \| *Maestro E2E: Keyboard avoiding view, message send, Report/Block action.* |
| `/profile` & `/profile/:id`| `app/(tabs)/profile/index.tsx`<br>`app/user/[id].tsx` | Tab Root & Push Stack | User profile, CineGraph chart, watchlist, bio. API: `GET /users/profile/:id`, `GET /users/profile-analysis`. | **P2** \| *Maestro E2E: Follow/unfollow toggle, Gifted Charts rendering.* |
| `/list` & `/my-lists` | `app/lists/index.tsx` | Push Stack | Custom curated lists discovery and management. API: `GET /lists/discover`, `GET /lists/me`. | **P3** \| *Maestro E2E: Create list modal, item addition/deletion.* |
| `/lists/:id` | `app/lists/[id].tsx` | Push Stack | List detail view, items grid, comment thread. API: `GET /lists/:id`, `PATCH /lists/:id`. | **P3** \| *Maestro E2E: List item reordering, comment posting, Report UGC.* |
| `/watchlist` | `app/watchlist.tsx` | Push Stack / Top Tab | User's saved watchlist and watched items. API: `GET /users/me/watchlist`, `DELETE /watchlist/:id`. | **P3** \| *Maestro E2E: Swipe-to-delete watchlist item.* |
| `/network` | `app/network.tsx` | Push Stack (Top Tabs) | Followers, Following, and Pending Follow Requests. API: `GET /users/me/following`, `GET /users/me/followers`. | **P2** \| *Maestro E2E: Accept/reject follow request buttons.* |
| `/content/:type/:contentId`| `app/content/[type]/[id].tsx`| Universal Push Stack | Movie/Series detail, ratings, reviews, streaming providers. API: `GET /movies/:id`, `GET /ratings/content/:id`. | **P2** \| *Maestro E2E: Star rating submission, review posting with spoiler tag.* |
| `/notifications` | `app/notifications.tsx` | Push Stack (Header Icon) | Activity and DM notification center. API: `GET /notifications`, `PATCH /notifications/mark-all-read`. | **P5** \| *Maestro E2E: Mark read on tap, mark all read button.* |
| `/settings` | `app/settings/index.tsx` | Modal / Push Stack | Account management, theme toggle, Letterboxd ZIP import, ≤3 tap Account Deletion, KVKK data export. | **P5** \| *Maestro E2E: Account deletion confirmation modal, document picker import.* |
| `/about`, `/privacy`, `/terms`| `app/legal/[doc].tsx` | Modal Stack | Static legal documentation, KVKK Aydınlatma Metni, and Terms of Service. Rendered via native typography. | **P6** \| *Jest Unit: i18n text hydration tests.* |

---

## 4. Required Backend Changes & Architecture

To maintain a single unified backend while delivering native mobile UX and adhering strictly to Apple App Store and Google Play API Level 36 compliance rules, we must implement a targeted set of robust backend extensions.

### 4.1 Refresh Token Flow with Mutex & Family Rotation
* **Problem:** Currently, `/api/users/login` issues a single JWT valid for 30 days (`expiresIn: "30d"`). If a token expires while a mobile user is in the app, they are abruptly logged out. Furthermore, without token rotation, stolen tokens cannot be revoked without invalidating all user sessions.
* **Backend Implementation:**
  1. Add a `refreshToken` schema structure (or a `refreshTokens` array on the `User` model) storing `{ tokenHash, familyId, expiresAt, deviceId, platform, isRevoked }`.
  2. Modify `/api/users/login` and `/api/users/register` to accept an optional `clientType: 'web' | 'mobile'` and `deviceId` in the request body.
  3. When `clientType === 'mobile'`, return a short-lived access token (`expiresIn: "15m"`) and a long-lived refresh token (`expiresIn: "90d"` with a unique `familyId`).
  4. Create endpoint `POST /api/users/refresh-token` accepting `{ refreshToken, deviceId }`.
  5. **Token Family Rotation & Reuse Detection:** When a refresh token is presented, verify its signature and check MongoDB. If the token is marked `isRevoked: true`, a token reuse attack is occurring. Immediately revoke **all** tokens in that `familyId` and return `403 Forbidden`, forcing user re-authentication. If valid, rotate by marking the presented token `isRevoked: true`, generating a new refresh token with the same `familyId`, and returning a fresh access token + rotated refresh token.
* **Mobile Client Integration:**
  1. In `@cinephix/shared/api`, implement a **Single-Flight Mutex** (request queueing promise) in the Axios response interceptor.
  2. When multiple concurrent requests fail with `401 Unauthorized`, only the first request triggers the `/api/users/refresh-token` API call. Subsequent failed requests queue onto the pending mutex promise.
  3. Upon rotation completion, the new access/refresh tokens are stored in `expo-secure-store`, and all queued requests replay automatically with the new Bearer header.

### 4.2 Sign in with Apple (Guideline 4.8), Native OAuth & Account Linking
* **Problem:** Apple App Store Review Guideline 4.8 strictly mandates that any app offering third-party social login (e.g., Google OAuth) **must** also offer Sign in with Apple. Furthermore, mobile OAuth should avoid browser redirects which degrade UX in webviews.
* **Backend Implementation:**
  1. **Google Native Endpoint (`POST /api/users/oauth/google-native`):** Accepts `{ idToken, platform }`. Verify token using `google-auth-library` (`OAuth2Client.verifyIdToken`) against iOS, Android, and Web client IDs. Extract `sub` (googleId), `email`, `name`, and `picture`.
  2. **Apple Native Endpoint (`POST /api/users/oauth/apple-native`):** Accepts `{ identityToken, authorizationCode, fullName, platform }`. Use `apple-signin-auth` or `jose`/`jwks-rsa` to cryptographically verify the JWT `identityToken` against Apple's public key JWKS (`https://appleid.apple.com/auth/keys`).
  3. **Schema Extensions:** Add `appleId: { type: String, unique: true, sparse: true }` to `backend/models/User.js`.
  4. **Account Linking Logic:** When an Apple or Google OAuth request arrives, check if a user exists with that `appleId` or `googleId`. If not found, check if a user exists with the matching `email` (verified). If an email match exists, securely link the account by populating `user.appleId` or `user.googleId` on the existing user record rather than creating a duplicate account.
  5. **Apple Private Relay Handling:** Apple Sign-In allows users to hide their email behind `@privaterelay.appleid.com` proxy addresses. The backend must register our outbound transactional email sender domain (`nodemailer`) with Apple's More Resources -> Services ID -> Sign in with Apple Email Relay service in Apple Developer Connect. Otherwise, verification and notification emails sent to private relay addresses will be bounced by Apple's servers.
* **Mobile Client Integration:** Use `@react-native-google-signin/google-signin` and `expo-apple-authentication` inside Development Builds to invoke native iOS/Android biometric authentication prompts, retrieving cryptographic tokens natively without browser tabs.

### 4.3 CORS, Helmet, and Native Origin Security (Strict Whitelist)
* **Problem Analysis & Security Rule:** In web environments, relaxing CORS to allow `!origin` with `credentials: true` creates a severe Cross-Site Request Forgery (CSRF) vulnerability. Native iOS and Android applications do not use browser HTTP engines; they are **not subject to CORS policies at all**. Native network requests do not trigger browser preflight OPTIONS checks or same-origin blocking.
* **Backend Implementation:**
  1. **Do NOT loosen CORS for mobile.** Maintain strict CORS whitelisting exclusively for our web application domains:
     ```javascript
     const allowedOrigins = [
       process.env.FRONTEND_URL || 'http://localhost:5173',
       'https://cinephix.com',
       'https://www.cinephix.com'
     ];
     app.use(cors({
       origin: (origin, callback) => {
         // Strict origin check for browser requests; allow server-to-server / native mobile (no origin)
         if (!origin || allowedOrigins.includes(origin)) {
           callback(null, true);
         } else {
           callback(new Error('Blocked by CORS policy'));
         }
       },
       credentials: true,
     }));
     ```
  2. **Security Authentication:** Because native mobile apps bypass CORS, API security for mobile relies **entirely** on strict cryptographic validation of JWT Bearer access tokens in the `Authorization` header, rate limiting, and input validation.
  3. Configure `helmet` security headers to allow REST JSON payloads and multipart form uploads from mobile clients without blocking.

### 4.4 Socket.io Mobile Handshake, Reconnection & Backend Tuning (Restored from v1.0)
* **Problem:** Mobile operating systems aggressively throttle or suspend network sockets when an app enters the background or sleep mode. When the app wakes up, the WebSocket is often dead, causing silent disconnection from chat rooms and missed messages. Furthermore, standard desktop socket timeouts cause frequent false disconnects over cellular latency.
* **Backend Implementation & Mobile Tuning:**
  1. **Socket.io Tuning:** Optimize `pingTimeout` and `pingInterval` in `server.js` explicitly for mobile cellular latency:
     ```javascript
     const io = new Server(httpServer, {
       pingTimeout: 60000,    // Increased from 20s to 60s to handle mobile 3G/4G packet jitter
       pingInterval: 25000,   // Heartbeat interval set to 25s to maintain cellular carrier NAT mappings
       cors: { origin: allowedOrigins, credentials: true }
     });
     ```
  2. **Graceful Token Re-Authentication:** In `backend/sockets/chatSocket.js`, ensure authentication middleware gracefully handles token re-authentication upon reconnection without dropping room memberships. When a client reconnects with a fresh rotated JWT in `socket.handshake.auth.token`, the server updates `socket.user` and automatically re-subscribes the socket to `user:${userId}` and any active chat rooms (`roomKey`).
* **Mobile Client Integration:**
  1. Implement an `AppState` listener in the React Native socket provider.
  2. When app transitions from `background` to `active`, verify socket connection state. If disconnected, explicitly trigger `socket.connect()` and re-emit `join-inbox` and any active `join-room` events.
  3. Implement exponential backoff for reconnection attempts during poor network connectivity.

### 4.5 Push Notifications Pipeline, Receipt Polling & Server-Side Localization
* **Problem:** Mobile real-time engagement requires Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM). However, tokens become stale when users uninstall the app or revoke permissions, causing delivery failures. Furthermore, push notifications must be localized to the user's language even when the app is closed.
* **Backend Implementation:**
  1. **Schema Extensions:** Add `preferredLanguage` (default `'en'`) and `deviceTokens` array to `backend/models/User.js`:
     ```javascript
     preferredLanguage: { type: String, enum: ['en', 'tr', 'es', 'de', 'fr'], default: 'en' },
     deviceTokens: [{
       token: { type: String, required: true },
       platform: { type: String, enum: ['ios', 'android'], required: true },
       lastUsedAt: { type: Date, default: Date.now }
     }]
     ```
  2. Endpoints: `POST /api/v1/users/me/push-tokens` and `DELETE /api/v1/users/me/push-tokens/:token`. When the user switches language in app settings, update `preferredLanguage` via `PUT /api/v1/users/profile`.
  3. Install `expo-server-sdk` in the Node backend. When events occur (new DM, follower request, list comment), query the recipient's `preferredLanguage` and lookup the corresponding localized translation string on the server before building the notification payload.
  4. **Receipt Polling & Automatic Pruning:** 15 minutes after dispatching push notifications, a scheduled job queries `expo.getPushNotificationReceiptsAsync(ticketIds)`. If Apple/Google returns an error stating `DeviceNotRegistered` or `InvalidCredentials`, the backend automatically removes that specific `token` from the user's `deviceTokens` array in MongoDB.
  5. **Badge Count Sync:** Include `badge: unreadCount` in the Expo push payload so iOS app icons reflect the accurate total number of unread DMs and notifications.

### 4.6 API Versioning & Minimum Supported App Version Gate
* **Problem:** Mobile apps remain installed on user devices for months without updating. Breaking API changes can crash outdated mobile clients.
* **Backend Implementation:**
  1. Prefix all mobile routes with `/api/v1/` while preserving web backwards compatibility.
  2. Endpoint: `GET /api/v1/app-config` returning:
     ```json
     {
       "minSupportedVersionIOS": "1.0.0",
       "minSupportedVersionAndroid": "1.0.0",
       "latestVersionIOS": "1.0.0",
       "latestVersionAndroid": "1.0.0",
       "maintenanceMode": false,
       "maintenanceMessage": ""
     }
     ```
* **Mobile Client Integration:** On startup in `app/index.tsx`, query `/api/v1/app-config`. If `Constants.expoConfig.version` is lower than `minSupportedVersion`, lock the app in a full-screen blocking modal directing the user to the Apple App Store or Google Play Store for a mandatory update.

### 4.7 Universal Links (iOS), Deep Links (Android) & Deferred Linking
* **Problem:** Clicking shared Cinephix links (movies, lists, profiles) via SMS/email should open directly inside the native app. Furthermore, if the user is unauthenticated when they tap a deep link or push notification, the intended route must not be lost.
* **Backend Implementation:**
  1. Serve Apple App Site Association at `GET /.well-known/apple-app-site-association` and Android Digital Asset Links at `GET /.well-known/assetlinks.json` with appropriate SHA-256 app certificate fingerprints.
* **Mobile Client Integration:**
  1. Configure `app.json` scheme (`cinephix://`) and universal associated domains (`applinks:cinephix.com`).
  2. **Deferred Deep Linking Pipeline:** In Expo Router, implement a deep link interceptor. When a deep link or push notification is tapped:
     * If authenticated: navigate immediately to target route (e.g., `/content/movie/123` or `/dm/456`).
     * If unauthenticated: save the target route URL string in `react-native-mmkv` under key `deferred_redirect_url`, redirect the user to `/login` or onboarding. Upon successful authentication, check `MMKV`, clear the key, and auto-navigate to the saved target route.

### 4.8 Google Translate API Proxy Endpoint
* **Problem:** The web client currently uses `@vitalets/google-translate-api` client-side. Including scraping libraries or direct Google API keys inside mobile app bundles violates security best practices, exposes API keys to reverse engineering, and causes IP rate-limiting failures on cellular networks.
* **Backend Implementation:**
  1. Create proxy endpoint `POST /api/v1/translate` accepting `{ text, targetLang, sourceLang }`.
  2. The Node server executes the translation using server-side credentials and caching translations in MongoDB/Redis to reduce redundant translation costs.
* **Mobile Client Integration:** Remove all client-side translation libraries. Replace call sites with `@cinephix/shared/api` requests to `POST /api/v1/translate`.

### 4.9 Abuse Prevention, Rate Limiting & Moderation SLA (Guideline 1.2)
* **Problem:** Apple App Store Review Guideline 1.2 strictly rejects social/chat applications that lack robust user-generated content (UGC) moderation and protection against spam/abuse.
* **Backend Implementation:**
  1. **Rate Limiting:** Install `express-rate-limit` on sensitive endpoints:
     * `/api/v1/users/login` & `/register`: Max 10 attempts per 15 minutes per IP.
     * `/api/v1/conversations/:id/messages` & `/groups/:slug/messages`: Max 30 messages per minute per user.
     * `/api/v1/reports`: Max 10 reports per hour per user.
  2. **Report & Block Endpoints:**
     * `POST /api/v1/reports` accepting `{ targetId, targetType: 'user' | 'review' | 'message' | 'list', reason, details }`.
     * `POST /api/v1/users/:id/block` and `DELETE /api/v1/users/:id/block`. Blocking a user automatically filters their DMs, reviews, and feed items from the reporter's queries.
  3. **Operational Moderation Workflow (24-Hour SLA):**
     * When a report is submitted to `POST /api/v1/reports`, the backend stores the report in MongoDB and immediately triggers an automated webhook notification to the internal team's Discord/Slack moderation channel (or admin email).
     * This ensures moderators review and action (ban user / delete content) within Apple's mandatory 24-hour SLA window.

### 4.10 Local Dev Networking & Environments
* **Problem:** When testing on physical iOS/Android devices or emulators, `http://localhost:5000` points to the mobile device itself, failing to reach the local Node backend running on the developer's computer.
* **Configuration Implementation:**
  1. Configure environment-specific API URLs in `app.config.ts` via `extra`:
     ```typescript
     const getApiUrl = () => {
       if (process.env.EAS_BUILD_PROFILE === 'production') return 'https://api.cinephix.com/api/v1';
       if (process.env.EAS_BUILD_PROFILE === 'preview') return 'https://staging-api.cinephix.com/api/v1';
       // Local development: use computer's LAN IP or ngrok/Cloudflare Tunnel
       return process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api/v1';
     };
     ```
  2. Developers will set `EXPO_PUBLIC_API_URL` in their local `.env` file to their machine's local LAN IP address (e.g., `192.168.1.X:5000`) or a Cloudflare Tunnel URL (`https://dev.cinephix.com`).

### 4.11 Cloudinary Signed Direct Uploads (Architecture Evaluation)
* **Problem:** In the web app, image uploads (avatars, group banners) are sent as multipart/form-data to the Node Express server (`multer`), which then proxies the upload to Cloudinary. On mobile over slow 3G/4G cellular networks, proxying large multipart payloads through our Node server consumes high server bandwidth, memory, and causes HTTP request timeouts.
* **Architecture Evaluation & Recommendation:** We recommend migrating to **Cloudinary Signed Direct Uploads from the mobile device**.
  * **How it works:** When a user selects and crops an avatar in `expo-image-picker`, the mobile client makes a lightweight JSON request to `GET /api/v1/cloudinary/sign?folder=avatars`.
  * The Node backend uses `cloudinary.utils.api_sign_request()` with our Cloudinary API Secret to generate a cryptographic signature, timestamp, and API key, returning it to mobile.
  * The mobile app uploads the compressed image directly to Cloudinary's global CDN endpoint (`https://api.cloudinary.com/v1_1/{cloud_name}/image/upload`) with the signature.
* **Technical Justification:** Eliminates 100% of image upload bandwidth from our Node server, prevents cellular timeout disconnections, and enables native upload progress bars on mobile!

---

## 5. Native & Cross-Platform Concerns

Building a production-grade mobile app requires addressing OS-level constraints, device hardware interfaces, state mapping, and strict compliance policies that do not exist in web browsers.

### 5.1 State Management Mapping (Web Contexts -> Mobile Architecture)
To ensure high performance without React re-render cascades, existing web React Contexts are systematically mapped to our target mobile state architecture:
* **AuthContext (`frontend/src/context/AuthContext.jsx`):** Mapped to **Zustand v5 + SecureStore**. A Zustand store (`useAuthStore`) holds synchronous user profile state in memory. Tokens are read/written asynchronously to `expo-secure-store` during bootstrap and token rotation.
* **ThemeContext (`frontend/src/pages/SettingsPage.jsx`):** Mapped to **NativeWind v4 + MMKV**. Synchronous `react-native-mmkv` reads theme preference (`forest`, `dark`, `light`) instantly on startup before app render, injecting the data-theme attribute into NativeWind without FOUC.
* **Socket / Chat Context (`frontend/src/hooks/useChat.js`):** Mapped to **Zustand v5 + AppState Provider**. The socket connection instance is managed inside a dedicated React Native provider that listens to OS `AppState` (active vs background).
* **Server Data / Caching (`frontend/src/api/cacheService.js`):** Mapped to **TanStack Query v5**. Replaces manual web caching with automated stale-while-revalidate caching, background refetching, and persistent offline cache storage backed by MMKV.

### 5.2 Permissions Management & iOS ATT
* **Just-in-Time (JIT) Permissions:** We request permissions exclusively when triggered by user action, preceded by an educational pre-prompt modal:
  * **Photo Library & Camera (`expo-image-picker`):** Requested only when tapping "Change Avatar" or attaching an image in group chat.
  * **Push Notifications (`expo-notifications`):** Requested after completing registration onboarding or when entering DMs.
* **Apple Privacy Manifest (`PrivacyInfo.xcprivacy`):** Configured via Expo SDK 56 app config plugins to declare Required Reason APIs (UserDefaults, file timestamps) as mandated by Apple.
* **App Tracking Transparency (ATT):** Because Cinephix does not track users across third-party apps or share data with ad networks, we **do not** trigger the ATT IDFA prompt. We declare "No Tracking" in App Store Connect.

### 5.3 Android 10+ (minSdkVersion 29) & Android 16 (targetSdkVersion 36) Independence
* **Explicit Android SDK Configuration:** These two settings are completely independent and serve different commercial and regulatory purposes:
  * **`minSdkVersion: 29` (Android 10):** The lowest OS threshold our compiled binary supports. Keeping `minSdkVersion: 29` ensures Cinephix remains installable on over 92% of active Android devices globally, maximizing user acquisition.
  * **`targetSdkVersion: 36` (Android 16 / API Level 36):** Required by Google Play's August 31, 2026 policy deadline for all new app submissions and updates. We configure `compileSdkVersion: 36` and `targetSdkVersion: 36` in `app.config.ts` while preserving `minSdkVersion: 29`.
* **Android 16 Behavior Changes Handled:**
  * **Predictive Back Animations:** Android 16 enforces gesture predictive back navigation. We enable predictive back in `app.json` (`android.predictiveBack: true`) and use React Navigation v7 native stack gestures so users can visually preview the destination screen while swiping back.
  * **Edge-to-Edge Enforcement:** Android 16 draws UI edge-to-edge behind system navigation and status bars by default. We wrap all screen containers in `SafeAreaView` from `react-native-safe-area-context` with explicit inset padding to prevent system bar occlusion.
  * **Photo Picker Privacy:** We utilize `expo-image-picker` which invokes Android's secure system Photo Picker (no `READ_EXTERNAL_STORAGE` permission required on Android 13+), granting read access solely to the specific photos selected by the user.
* **Keyboard Avoidance:** Utilizes `react-native-keyboard-controller` for smooth 120fps synchronized keyboard opening animations in DMs and comment threads without input occlusion.

### 5.4 App Icons, Splash Screen & Theme Hydration (Restored from v1.0)
* **Adaptive Icon Layers:** We design a high-resolution adaptive icon set (1024x1024 PNG) supporting Android Adaptive Icons (separate foreground asset layer + background color/mesh vector) and iOS square icons.
* **Splash Screen Hold & Theme Hydration:** Configured via `expo-splash-screen`. To prevent Flash of Unstyled Content (FOUC) or white flickering during app startup, the native splash screen is kept visible via `SplashScreen.preventAutoHideAsync()` until:
  1. `react-native-mmkv` synchronously reads the saved theme (`forest`, `dark`, `light`) and hydrates NativeWind tokens.
  2. `expo-secure-store` verifies session tokens and hydrates `useAuthStore`.
  3. Once both state trees are ready, `SplashScreen.hideAsync()` smoothly fades into the localized shell.

### 5.5 Offline State, Optimistic Updates & Poor Network Handling (Restored from v1.0)
* **Network Connectivity Monitoring:** Use `@react-native-community/netinfo` to continuously monitor network reachability. When offline, display an animated top banner: *"No internet connection. Showing offline cached data."*
* **TanStack Query MMKV Persistence:** Configure QueryClient with persistent storage (`createAsyncStoragePersister` backed by synchronous MMKV). Users can read their personalized feed, viewed movie details, and downloaded custom lists while completely offline in subways or airplane mode.
* **Optimistic Updates & Automatic Rollback:** For high-frequency social interactions (liking a review, submitting a movie star rating, adding an item to watchlist, or dispatching a chat DM), UI state updates instantaneously on the native UI thread before network confirmation. If the Axios HTTP request fails due to network loss, TanStack Query automatically rolls back the optimistic UI state and displays a native error toast (`burnt`).

### 5.6 Background Behavior & Scheduled Work (Restored from v1.0)
* **Socket Suspend/Resume Grace Period:** When `AppState.currentState === 'background'`, keeping a WebSocket connection open drains battery and cellular data. We implement a **10-second grace period**: if the app remains backgrounded for over 10 seconds, the socket cleanly disconnects. When returning to `'active'`, the socket reconnects immediately and fetches missed messages via REST `/api/v1/conversations/:id/messages?after={lastMessageTimestamp}`.
* **Server-Side Scheduled Work Decision:** We explicitly decide **not** to execute background JavaScript cron jobs or heavy algorithmic tasks on user mobile devices. All scheduled background work (such as calculating weekly popular content, updating algorithmic taste compatibility matrices, and database cleanup) remains strictly **server-side in existing Node.js `node-cron` jobs**, delivering engagement updates to mobile clients exclusively via lightweight Apple/Google push notifications.

### 5.7 Secure Storage & Token Vaulting Limits
* **Never use AsyncStorage for Secrets:** Standard AsyncStorage is unencrypted plain text on Android and accessible via iTunes backup on iOS.
* **Expo Secure Store:** Access tokens and refresh tokens are stored using 256-bit AES encryption in iOS Keychain and Android Keystore.
* **iOS Keychain 2KB Limit Note:** iOS Keychain items have a strict ~2KB data size limit. Storing large JSON user objects inside SecureStore will fail or truncate. Therefore, we **strictly separate storage keys**:
  * `cinephix_access_token` -> Stored in `expo-secure-store` (raw string, ~200 bytes).
  * `cinephix_refresh_token` -> Stored in `expo-secure-store` (raw string, ~200 bytes).
  * `cinephix_user_profile` -> Stored in `react-native-mmkv` (non-sensitive user display data, avatar URL, preferences; fast synchronous access).

### 5.8 SSL/TLS Enforcement & Certificate Pinning (Restored from v1.0)
* **HTTPS & TLS 1.3 Enforcement:** To mitigate Man-in-the-Middle (MitM) attacks on public Wi-Fi networks, all production mobile builds strictly enforce HTTPS communication with TLS 1.3 encryption. Cleartext HTTP requests are explicitly blocked in native iOS (`NSAppTransportSecurity`) and Android network security configurations.
* **Certificate Pinning Option & Tradeoffs:** For maximum cryptographic security, SSL Certificate Pinning can be configured via build plugins, binding the app to our exact Cloudflare/SSL public key hash. 
  * *Tradeoff:* While pinning eliminates MitM risks from compromised certificate authorities, if our SSL certificate rotates unexpectedly without an app update, **the installed mobile app will brick and refuse all network connections**. We recommend monitoring SSL rotation schedules via automated CI warnings if pinning is enabled.

### 5.9 Letterboxd ZIP/CSV Import on Mobile
* **Problem:** In web settings, users drag-and-drop or select a Letterboxd export ZIP file (`SettingsPage.jsx`). On mobile, file system access diverges significantly between iOS and Android.
* **Mobile Implementation:**
  1. Use `expo-document-picker` (`DocumentPicker.getDocumentAsync({ type: ['application/zip', 'text/csv'] })`).
  2. **iOS vs Android Differences:** On iOS, selecting a file from iCloud or Files creates a temporary sandbox copy (`file:///var/mobile/Containers/...`). On Android, the Storage Access Framework (SAF) returns a content URI (`content://com.android.providers.media.documents/...`).
  3. **File Reading & Upload:** Use `expo-file-system` to verify file size and read chunk streams if necessary, or pass the native URI directly to a multipart upload request to `POST /api/v1/users/profile/import-letterboxd` with an interactive native progress bar (`axios.onUploadProgress`).

### 5.10 Observability, Crash Reporting & Product Analytics (PostHog)
* **Crash Reporting (`@sentry/react-native` v6+):** Integrated into `app/_layout.tsx` to capture unhandled JavaScript exceptions, native iOS/Android crashes (ANRs), and API network failures.
* **Source Map Uploading:** Configured via `@sentry/react-native/expo` config plugin in `app.config.ts`. During EAS Build cloud compilation, release symbols and source maps are automatically uploaded to Sentry, enabling human-readable stack traces in production.
* **Product Analytics SDK (`posthog-react-native` v3+):** To track user engagement without violating Turkish KVKK or European GDPR data privacy laws, we integrate **PostHog React Native** as our product analytics engine (replacing generic tracking). PostHog provides open-source, privacy-compliant event tracking, feature flags, and user funnels without third-party data selling or sampling limits.
* **Minimal Analytics Event Tracking List:**
  * `user_login_success` (`{ method: 'email' | 'google' | 'apple' }`)
  * `match_compatibility_viewed` (`{ targetUserId, score }`)
  * `content_rated` (`{ contentType: 'movie' | 'series', rating }`)
  * `dm_message_sent` / `group_message_sent`
  * `list_created` / `letterboxd_import_completed`
  * `error_boundary_triggered` (`{ screen, error }`)

### 5.11 Continuous Integration (CI) & Automated Testing Pipeline
To ensure code quality and prevent regressions across our monorepo workspaces, we establish a two-tier CI testing pipeline using **GitHub Actions and EAS Build**:
* **Tier 1: Fast Pull Request Validation (GitHub Actions):**
  * Triggered on every git push and PR against `main`.
  * Runs `npm test` across root workspaces: executes **Jest + React Native Testing Library (RNTL)** unit tests for `@cinephix/shared` validation schemas, date helpers, state reducers, and native component renders.
  * Verifies TypeScript strict type-checking (`tsc --noEmit`) and ESLint style compliance.
* **Tier 2: Automated End-to-End User Flows (Maestro + EAS Build):**
  * Triggered on release branch merges or nightly staging schedules.
  * Compiles an Expo Development Build `.app` (iOS Simulator) and `.apk` (Android Emulator) in EAS cloud CI.
  * Runs **Maestro** E2E automated YAML test scripts against the compiled native bundles on headless cloud emulators, executing core user journeys:
    1. `auth-flow.yaml`: Email signup with KVKK consent check -> verification -> logout -> Google native login.
    2. `profile-avatar.yaml`: Navigate to setup -> open native photo picker -> crop image -> verify Cloudinary signed upload -> check bio save.
    3. `chat-realtime.yaml`: Two-client simulation joining `/dm/123` -> sending emoji reaction -> verifying real-time message receipt -> verifying background socket reconnect.

### 5.12 EAS Update & Over-The-Air (OTA) Strategy
* **OTA Channels & Runtime Policy:**
  * **Channels:** `production` (maps to live App Store / Google Play builds) and `preview` (maps to staging internal tester builds).
  * **Runtime Version Policy:** Configured to `{ "policy": "appVersion" }` in `app.json`. OTA updates are strictly scoped to the exact major.minor native app version (e.g., `1.0.0`).
* **Store Compliance & What May be Shipped OTA:**
  * **Allowed OTA:** Pure JavaScript/TypeScript bug fixes, React component UI adjustments, translation string updates, and styling tweaks.
  * **Prohibited OTA (Requires Store Review):** Adding new native SDK modules, upgrading React Native / Expo SDK engine versions, or significantly altering core app functionality (e.g., pivoting from social discovery to an unrelated gaming feature). Violating this triggers immediate Apple App Store removal under Guideline 2.5.2.
* **Rollback Procedure:** If a faulty OTA update is published, run `eas update:rollback --channel production` via CLI to instantly revert all client apps to the prior stable bundle within seconds.

### 5.13 Accessibility (a11y) Standards
* **Conventions:** All interactive elements (`Pressable`, `TouchableOpacity`, custom buttons) must include explicit `accessibilityLabel`, `accessibilityHint`, and `accessibilityRole` (`button`, `link`, `header`, `image`).
* **Contrast Targets:** Ensure text and background colors meet **WCAG 2.1 Level AA** minimum contrast ratio of **4.5:1** across light, dark, and forest themes.
* **Dynamic Font Scaling (200% Text Size Survival):**
  * Never hardcode fixed heights on text containers, cards, or buttons (e.g., avoid `h-12`; use `min-h-[48px]` and padding instead).
  * Enable text wrapping (`flex-wrap`) on multi-item rows and ensure all screen forms wrap in `ScrollView` so users with 200% accessibility font scaling can scroll and read all UI elements without text overlap or clipping.

---

## 6. Phased Implementation Roadmap & Milestones (Revised Gantt & Testing DoD)

All implementation phases are planned sequentially for Phase 2 implementation following your final approval. No phases are marked active or complete.

```mermaid
gantt
    title Cinephix Mobile Engineering Roadmap (v1.3)
    dateFormat  YYYY-MM-DD
    axisFormat  Phase %m
    section Architecture & Shell
    Phase 1: Auth, Shared Layer, Dev Builds, KVKK & Shell :p1, 2026-08-01, 14d
    section Core Domain
    Phase 2: Profiles, Avatars & Onboarding               :p2, after p1, 14d
    Phase 3: Discovery, Feed, Lists & Matching            :p3, after p2, 21d
    section Social & Realtime
    Phase 4: Realtime Chat Groups & DMs                   :p4, after p3, 14d
    section Polish, Compliance & Launch
    Phase 5: Stats, Charts, Deletion & i18n Polish        :p5, after p4, 10d
    Phase 6: Push, Moderation & Store Submission          :p6, after p5, 14d
```

### Phase 1: Auth, Shared Layer, Dev Builds, KVKK & App Shell
* **Scope:**
  * Formalize root `npm workspaces` and extract `@cinephix/shared` package (API axios client, types, constants, validation schemas, i18n JSONs).
  * Initialize Expo SDK 56 project with TypeScript strict mode, ESLint, Prettier, and NativeWind v4.
  * **Development Builds Setup:** Configure Expo Prebuild (`npx expo run:ios` / `npx expo run:android`) and EAS dev profiles from day one; verify native module linking for MMKV v3, Sentry, Google Sign-In, and Apple Authentication.
  * Implement Expo Router v6 file skeleton (Bottom Tabs + Stack Navigators).
  * Build full Authentication suite: Email/Password, Google OAuth (Native ID Token exchange), and **Sign in with Apple (Guideline 4.8)**.
  * Implement **Turkish KVKK Compliance** (consent checkbox at signup, Aydınlatma Metni clarification text modal, privacy policy acceptance).
  * Implement SecureStore token vaulting and Axios single-flight mutex refresh-token rotation pipeline.
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Pass 100% of validation schema tests, JWT utilities, and Axios single-flight mutex rotation queue logic.
  * **Maestro E2E Tests:** Automated test scripts run in CI against compiled Development Builds, verifying email/password signup with KVKK check, login, Apple Sign-In native trigger, session persistence on app restart, and automatic token refresh upon simulated 401 error.
  * **Web Smoke Test:** Run web app build and tests to verify extracting `@cinephix/shared` caused zero regressions on web.

### Phase 2: User Profiles, Avatars & Onboarding
* **Scope:**
  * Build post-signup profile setup flow (Bio, Avatar photo upload).
  * Implement native photo selection and cropping using `expo-image-picker` and `expo-image-manipulator`.
  * Integrate Cloudinary Signed Direct Upload pipeline (`GET /api/v1/cloudinary/sign` -> direct CDN upload).
  * Build User Profile screen (`app/(tabs)/profile/index.tsx`) and Public Profile view (`app/user/[id].tsx`).
  * Implement Follow / Unfollow / Accept Follow Request social graph interactions and Network list screens.
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Pass unit tests for social graph state reducer and follower formatting.
  * **Maestro E2E Tests:** Automated flow selects photo from device library, crops image, uploads via signed Cloudinary signature, and verifies profile avatar and bio update across screen navigations in CI.

### Phase 3: Discovery, Feed, Lists & Taste Matching
* **Scope:**
  * Build Activity Feed tab (`app/(tabs)/index.tsx`) with infinite scroll, pull-to-refresh, TanStack Query caching, and skeleton loading states.
  * Build Movie and Series catalog browsing, searching, and detail screens (`app/content/[type]/[id].tsx`) with TMDB image caching via `expo-image`.
  * Implement Rating (1-10 stars) and Review creation modals with spoiler tagging.
  * Build Custom Lists discovery, creation, item reordering, and detail views.
  * Build Taste Matching screen (`app/(tabs)/match.tsx`) with interactive compatibility scoring cards.
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Pass unit tests for debounced search hooks and compatibility percentage mathematical calculations.
  * **Maestro E2E Tests:** Automated test scripts verify scrolling feed, filtering movies by genre, submitting an 8-star rating, creating a custom list, and executing a taste match comparison card swipe in CI.

### Phase 4: Realtime Chat Groups & DMs
* **Scope:**
  * Build Community Groups list and dedicated discussion rooms (`app/(tabs)/community/[slug].tsx`).
  * Build Direct Messaging inbox (`app/(tabs)/messages/index.tsx`) and private chat rooms (`app/(tabs)/messages/[id].tsx`).
  * Integrate `socket.io-client` with App-State lifecycle management (auto-reconnect on active, 10s grace period disconnect on background, ping heartbeats).
  * Implement native chat bubbles, timestamps, unread badge counts, and emoji reaction pickers (`rn-emoji-keyboard`).
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Verify socket event dispatcher and unread badge increment/decrement reducers.
  * **Maestro E2E Tests:** Automated two-client CI simulation verifies dispatching a chat DM, receiving real-time message bubble on recipient screen, keyboard avoidance behavior, and verifying socket auto-reconnect after simulated background/foreground AppState transition.

### Phase 5: Stats, Charts, ≤3-Tap Deletion & i18n Polish
* **Scope:**
  * Port web `Chart.js` components to native vector charts using `react-native-gifted-charts` (Donut/Pie for genre breakdown, Bar charts for rating distributions with touch tooltips).
  * Implement **Account Deletion Flow (Guideline 5.1.1v)**: **reachable in ≤3 taps from Settings** (`app/settings/index.tsx`), with explicit re-authentication confirmation modal and backend data purge trigger.
  * Implement **Letterboxd ZIP/CSV Import** using `expo-document-picker` and native progress bar.
  * Integrate `expo-localization` with `i18next` for instant language switching across English, Turkish, Spanish, German, and French, and NativeWind dark/light/forest themes.
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Verify chart data transformation utilities and i18n translation key completeness across all 5 language files.
  * **Maestro E2E Tests:** Automated script navigates to Settings -> Delete Account in **≤3 taps**, verifies confirmation modal display, executes document picker file import, and verifies Gifted Charts render without UI thread frame drops in CI.

### Phase 6: Push Notifications, Moderation & Store Submission Prep
* **Scope:**
  * Implement backend push notification service using `expo-server-sdk`, server-side translation string lookup (via `preferredLanguage`), receipt polling, and automatic pruning of unregistered tokens.
  * Integrate `expo-notifications` on mobile for push registration, foreground banner display, badge syncing, and deferred deep-link routing upon notification tap.
  * Implement **mandatory Apple App Store Guideline 1.2 compliance**: In-app "Report Content / User" and "Block User" action sheets in profiles, chat rooms, and reviews, backed by Discord/Slack moderation alerting.
  * Configure production EAS Build profiles (`eas.json`), app signing certificates, adaptive icons, PostHog analytics, Sentry crash reporting, and privacy manifests targeting Android API 36 (`minSdkVersion 29`).
* **Definition of Done (DoD) & Test Coverage:**
  * **Jest Unit Tests:** Verify push notification receipt pruning algorithm, localized title/body server lookup, and report submission rate-limiting.
  * **Maestro E2E Tests:** Automated script opens user profile, taps "Block User", verifies user messages disappear from inbox, and verifies tapping "Report Content" opens action sheet and submits payload in CI.
  * **Store Verification:** EAS production builds (`.ipa` and `.aab`) target Android API 36 (`minSdkVersion 29`), compile cleanly without warnings, and pass Apple Transporter and Google Play Pre-launch Report automated validation checks.

---

## 7. Comprehensive Risk Register & Mitigation Matrix

| # | Risk Description | Likelihood | Impact | Technical Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | **Socket.io Disconnections & Missed Messages on Mobile Backgrounding** | **High** | **High** | Implement explicit `AppState` listener with 10s grace period disconnect. When transitioning from background to active, force socket re-connect and execute a catch-up REST API query for messages timestamped after `lastReceivedMessageAt`. |
| **R2** | **App Store Rejection via Guideline 1.2 (User Generated Content Moderation)** | **High** | **Critical** | Apple strictly rejects social/chat apps lacking user safety tools. We will build a native action sheet on all UGC (reviews, DMs, profiles) allowing users to "Report Content" and "Block User", backed by backend flags and admin webhook alerting to meet the 24-hour SLA. |
| **R3** | **Cloudinary Image Upload Failures on Weak Cellular Networks** | **Medium** | **High** | Replace Node server proxying with Cloudinary Signed Direct Uploads (`GET /api/v1/cloudinary/sign`). Use `expo-image-manipulator` to compress images client-side (max 1024px, 0.8 quality), reducing payload size by 80%+ and uploading directly to CDN. |
| **R4** | **JWT Access Token Expiration During Active Mobile Usage** | **High** | **High** | Implement the Refresh Token rotation pipeline with Single-Flight Mutex (Section 4.1). Axios interceptor catches 401s, queues concurrent requests, rotates tokens via background call, and replays failed requests transparently. |
| **R5** | **Google OAuth Redirect & Cookie Failures in Native WebViews** | **High** | **Medium** | Avoid browser-based OAuth redirects on mobile entirely. Use native SDKs (`@react-native-google-signin/google-signin` and `expo-apple-authentication`) inside Development Builds to retrieve ID tokens natively and exchange them via backend API (Section 4.2). |
| **R6** | **Web Regression Risk when Extracting `@cinephix/shared`** | **Medium** | **High** | Extracting shared logic into npm workspaces could inadvertently break existing web imports or build configs. **Mitigation:** Execute a mandatory Web Smoke-Test Checklist before merging Phase 1: verify Vite build succeeds (`npm run build`), login/register works on web, profile analysis loads, and socket chat connects. |
| **R7** | **App Store Dating-Adjacent Scrutiny & 17+ Rating Decision** | **High** | **High** | Because Cinephix positions itself as "meet and connect with people based on taste in movies", Apple App Review may classify the app as dating-adjacent or open social discovery, subjecting it to heightened scrutiny under Guideline 1.2 and requiring a **17+** age rating. **Mitigation:** We explicitly set the age rating to 17+ in store metadata and include clear UI copy framing connections around cinema discussion rather than romantic matchmaking. |
| **R8** | **TMDB Attribution & Content Licensing Store Rejection** | **Medium** | **High** | Apple and Google routinely reject movie/TV discovery apps that display copyrighted movie posters without API attribution or licensing proof. **Mitigation:** Explicitly include the official TMDB logo and mandatory legal attribution notice (*"This product uses the TMDB API but is not endorsed or certified by TMDB"*) in the app's About screen (`app/legal/about.tsx`) and in store descriptions. |
| **R9** | **Timeline Realism & Reduced-Scope v1.0 Binary Option (No OTA Deferral)** | **High** | **Medium** | The 6-phase roadmap assumes dedicated full-time engineering. If timeline constraints or review delays arise, attempting to ship all features at once risks missing target launch dates. **Mitigation (Reduced-Scope v1.0 Binary Launch Option):** If needed, we can execute an initial v1.0 store launch upon completing **Phase 4** (shipping Core Shell, Auth, Profiles, Discovery/Matching, and Realtime Chat). Because Guideline 2.5.2 prohibits adding new features via OTA updates, deferred features (Custom Lists, Gifted Charts, and Letterboxd imports) will be released as a standard **v1.1.0 App Store / Play Store binary update**. |

---

## 8. Store Submission Checklist & Compliance (iOS App Store & Google Play API 36)

### 8.1 Apple App Store Connect (iOS)
- [ ] **Developer Account:** Verify active Apple Developer Program membership ($99/year).
- [ ] **Bundle Identifier:** Register explicit App ID (`com.cinephix.app`) with Push Notifications, Associated Domains, and Sign in with Apple capabilities enabled.
- [ ] **Sign in with Apple (Guideline 4.8):** Verify native FaceID/TouchID Apple login functions end-to-end and Apple Private Relay email domains (`@privaterelay.appleid.com`) are configured in Apple Developer Connect for outbound email delivery.
- [ ] **Account Deletion (Guideline 5.1.1v):** Verify user can delete their account in **≤3 taps** from `Settings -> Delete Account`, with immediate session purge and database record removal. Include public web data deletion URL in App Store Connect metadata.
- [ ] **App Tracking Transparency & Privacy Manifest:** Include verified `PrivacyInfo.xcprivacy` declaring Required Reason APIs. Set ATT tracking description to explain no third-party ad tracking occurs.
- [ ] **Guideline 1.2 Compliance (Social & UGC Moderation):**
  - [ ] Terms of Service (EULA) and Privacy Policy accessible during signup and in app settings.
  - [ ] In-app reporting mechanism for offensive movie reviews, list comments, and direct messages.
  - [ ] Immediate ability to block abusive users, instantly filtering their messages and content from feed.
  - [ ] Backend Discord/Slack webhook alerting to review and act on reported users within the mandatory 24-hour SLA.
- [ ] **KVKK & GDPR Compliance:** Consent checkbox on registration screen, Aydınlatma Metni modal in settings, and data export capability.
- [ ] **TMDB Attribution Notice:** Verify TMDB logo and legal disclaimer appear in About screen.
- [ ] **Age Rating:** Set maturity rating to **17+** due to open social discovery, user-to-user chat, and discussion of mature film/TV themes.
- [ ] **App Review Demo Account:** Provision static test account (`apple-review@cinephix.com`) with pre-populated matches, chat history, and lists for Apple review testers.

### 8.2 Google Play Console (Android API Level 36 Mandate)
- [ ] **Developer Account:** Verify active Google Play Console developer account ($25 one-time fee).
- [ ] **Target API Level 36 Mandate & minSdk 29:** Verify `app.config.ts` compiles and targets **Android 16 (`targetSdkVersion 36`)** while preserving **`minSdkVersion: 29` (Android 10)**, ensuring full compliance with Google Play's August 31, 2026 deadline without abandoning older Android devices.
- [ ] **Data Safety Section & Deletion URL:** Complete comprehensive Data Safety form declaring collection of Email, User IDs, Messages, and Photos. Provide active web URL where users can request account/data deletion without reinstalling the app.
- [ ] **Android 13+ / 16 Permissions:** Declare `POST_NOTIFICATIONS` and utilize Android's secure Photo Picker (avoiding broad `READ_EXTERNAL_STORAGE` permissions) with clear runtime justifications.
- [ ] **Android 16 Edge-to-Edge & Predictive Back:** Verify system navigation bars do not obscure bottom tabs or input forms, and predictive back animations function smoothly.
- [ ] **KVKK / GDPR Compliance:** Verify Aydınlatma Metni and Turkish language privacy consent rules.
- [ ] **TMDB Attribution Notice:** Verify TMDB legal attribution is present in app and Play Store description.
- [ ] **App Signing by Google Play:** Configure EAS Build to generate an Android App Bundle (`.aab`) and let Google manage production app signing keys via Google Play App Signing.

---

## 9. Appendix: Complete Phase 0 Codebase Audit Findings

### 9.1 Complete Socket.io Event Inventory
This table documents every Socket.io event currently present in the Cinephix backend (`backend/sockets/chatSocket.js`) and web frontend (`frontend/src/hooks/useChat.js` / `frontend/src/hooks/useInbox.js`), along with required mobile extensions.

| Event Name | Direction | Payload Structure | Purpose & Current Usage | Target Mobile Action |
| :--- | :--- | :--- | :--- | :--- |
| `connection` / `auth` | Handshake | `{ auth: { token: "JWT..." } }` | Authenticates socket via JWT in `chatSocket.js`. | Keep. Pass secure access token from `expo-secure-store`. |
| `join-room` | Client -> Server | `{ roomType: "dm" \| "group", roomId: "ID" }` | Joins specific chat room channel (`roomKey`). | Emit when opening chat screen; re-emit on AppState active. |
| `leave-room` | Client -> Server | `{ roomType: "dm" \| "group", roomId: "ID" }` | Leaves chat room channel on screen unmount. | Emit when unmounting chat screen or entering background. |
| `send-message` | Client -> Server | `{ roomType, roomId, text, clientTempId }` | Dispatches new chat message to MongoDB and peers. | Emit on message send with optimistic UI bubble insertion. |
| `new-message` | Server -> Client | `Message Document (populated sender)` | Broadcasts newly saved message to all users in room. | Listen in chat screen; append to Zustand/Query message list. |
| `conversation-updated`| Server -> Client | `{ conversationId, lastMessage, lastMessageAt }` | Updates inbox list snippet and unread badge timestamp. | Listen in inbox provider; update inbox list and badge count. |
| `new-notification` | Server -> Client | `Notification Document` | Triggers real-time in-app toast/alert for new DM/follow. | Listen globally; trigger `burnt` native banner & push badge sync.|
| `error` | Server -> Client | `{ message: "Error description string" }` | Returns socket authorization or validation failure. | Listen globally; display native error toast / trigger token refresh.|
| `typing-start` / `stop`| Client <-> Server | `{ roomType, roomId, username }` | **[Currently Absent in Codebase]** Real-time typing indicators. | Defer to v1.1 or add as lightweight transient emit in Phase 4. |
| `read-receipt` | Client <-> Server | `{ conversationId, messageId, readBy }` | **[Currently REST-Only]** Handled via `POST /api/conversations/:id/read`. | Keep REST read acknowledgment; trigger unread badge decrement. |

---

### 9.2 Complete Web-Only API Audit Table
This table lists every verified file in `frontend/src` utilizing DOM or browser-only APIs that block code sharing, along with its exact mobile-safe replacement using plain backticked repo-relative paths.

| Verified File Path | Web-Only API / DOM Dependency | Why it Blocks Code Sharing | Target Mobile-Safe Replacement |
| :--- | :--- | :--- | :--- |
| `frontend/src/context/AuthContext.jsx` | `localStorage.getItem/setItem("user")` | Synchronous browser web storage API; does not exist in React Native. | `expo-secure-store` (for JWT access/refresh tokens) + `react-native-mmkv` (for user profile object). |
| `frontend/src/api/axios.js` | `localStorage.getItem("user")` | Axios request interceptor reads JWT from browser localStorage. | Shared Axios interceptor in `@cinephix/shared` reading asynchronously from `expo-secure-store`. |
| `frontend/src/pages/SettingsPage.jsx` | `localStorage.getItem("theme")`, `document.documentElement.setAttribute` | DOM manipulation and web local storage used for theme switching and active tabs. | `react-native-mmkv` for fast synchronous storage + NativeWind v4 color scheme toggle (`useColorScheme`). |
| `frontend/src/pages/SetupProfilePage.jsx`| `new File()`, `URL.createObjectURL()`, `FormData`, `react-easy-crop` | HTML5 Canvas cropping and DOM File/Blob objects used for avatar photo upload. | `expo-image-picker` + `expo-image-manipulator` for native device photo cropping + Cloudinary signed upload. |
| `frontend/src/pages/SettingsPage.jsx` | `new File()`, `URL.createObjectURL()`, drag-and-drop `e.dataTransfer.files` | Web file drop APIs used for Letterboxd ZIP/CSV data import and avatar change. | `expo-document-picker` for native iOS Files / Android SAF document selection and uploading. |
| `frontend/src/pages/VerifyEmailPage.jsx`| `localStorage.setItem("user")` | Saves updated verification user state directly to browser storage. | Call shared `updateUser()` action in Zustand store + MMKV sync. |
| `frontend/src/components/CineGraph.jsx` | `chart.js`, `react-chartjs-2`, HTML5 `<canvas>` | Chart.js requires a DOM canvas element and browser rendering engine. | `react-native-gifted-charts` for native vector Donut/Pie chart rendering at 60fps. |
| `frontend/src/components/RatingDistribution.jsx`| Custom `div` style heights, `onMouseEnter`, DOM tooltip hover | Desktop mouse hover events (`onMouseEnter`) and HTML div bar charts. | `react-native-gifted-charts` Bar Chart component with native touch tooltip gestures. |
| `frontend/src/i18n.js` | `i18next-browser-languagedetector` (`window.navigator`) | Scrapes browser `navigator.language` and `localStorage` to detect user locale. | `expo-localization` (`getLocales()[0].languageCode`) to detect native iOS/Android system language. |
| `frontend/src/App.jsx` | `window.location.pathname`, `localStorage.getItem('theme')`, `document.documentElement` | Scrapes window URL path for splash screen logic and injects DOM data-theme attribute. | Expo Router file-based initial route checks + NativeWind theme provider in `app/_layout.tsx`. |
| `frontend/src/components/Footer.jsx`, `frontend/src/components/TopBar.jsx`| `window.scrollTo(0, 0)`, DOM `<header>`, `<footer>` | Web browser window scroll commands and semantic HTML5 DOM tags. | Native `ScrollViewRef.scrollTo({ y: 0 })` and native React Native `View`/`SafeAreaView` containers. |

---

## 10. Clarifying Questions for Product Ownership (Batch List)

Before commencing **Phase 2 (Scaffolding & Implementation)** upon your final approval of v1.3.0, please confirm your stance on the following batched items:

1. **Developer Accounts & Minimum OS Support Threshold:** Do you currently have active Apple Developer Program ($99/yr) and Google Play Console ($25) accounts ready for EAS cloud builds, and do you approve our recommended minimum supported operating systems of **iOS 16+** and **Android 10+ (`minSdkVersion 29`)** (separately from Google Play's mandatory `targetSdkVersion 36` requirement)?
2. **Apple Guideline 1.2 Moderation SLA & Tooling:** To meet Apple's mandatory 24-hour SLA for user-generated content reports, should our new `POST /api/v1/reports` endpoint dispatch real-time webhook alerts directly to your team's Discord/Slack channel, or do you prefer an email notification alert to an admin address?
3. **Push Notification Infrastructure (APNs/FCM):** Do you already have a Firebase project created for Android Cloud Messaging (FCM) and Apple Push Notification certificates/keys ready to plug into our Expo Push Notification backend pipeline?
4. **App Store 17+ Rating & Dating-Adjacent Scrutiny:** Because Cinephix connects users based on movie taste, Apple App Review may scrutinize it under social discovery/dating rules (Risk R7). Do you explicitly approve submitting the app with a **17+** maturity rating in App Store Connect to ensure smooth review approval?
5. **Monorepo Package Manager Preference:** We plan to formalize standard **npm workspaces** at the root level to link `@cinephix/shared`, `frontend`, `backend`, and `mobile` (preserving your existing root `package-lock.json`). Do you confirm `npm workspaces`, or would you prefer switching to `pnpm`?

---
*End of Phase 1 Migration Plan Document v1.3.0. Approved for Phase 2 Scaffolding & Implementation.*
