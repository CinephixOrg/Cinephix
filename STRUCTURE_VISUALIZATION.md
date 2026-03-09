# Project Structure Visualization

## Frontend Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Pages       │  │  Components  │  │  Common Components   │   │
│  │  -----------│  │  -----------│  │  ─────────────────────│   │
│  │ LoginPage    │  │ MovieCard    │  │ LoadingSpinner      │   │
│  │ HomePage     │  │ UserRow      │  │ StarRating          │   │
│  │ ProfilePage  │  │ SearchBar    │  │ ImageCropper        │   │
│  │ MatchPage    │  │ TopBar       │  │ Modal               │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         ↓                  ↓                    ↓                 │
└─────────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    REACT HOOKS & STATE                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ useState          useContext           useEffect           │ │
│  │                                                            │ │
│  │ Custom Hooks:                                            │ │
│  │ • useApi()      - Fetch with loading/error states      │ │
│  │ • useDebounce() - Debounce search input               │ │
│  │ • useLocalStorage() - Persist user preferences        │ │
│  │ • useAsync()    - Handle async operations             │ │
│  └────────────────────────────────────────────────────────────┘ │
│           ↓                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             CONTEXT API (Global State)                     │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ AuthContext              RatingsContext             │   │ │
│  │ │ ────────────             ──────────────             │   │ │
│  │ │ • user                   • ratings                  │   │ │
│  │ │ • token                  • favorites                │   │ │
│  │ │ • isAuthenticated        • watchlist                │   │ │
│  │ │ • login()                • addRating()              │   │ │
│  │ │ • logout()               • removeRating()           │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API SERVICE LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ authService  │  │ userService  │  │ contentService      │   │
│  │ ────────────│  │ ────────────│  │ ─────────────────────│   │
│  │ • login()    │  │ • getProfile│  │ • getMovies()       │   │
│  │ • register() │  │ • updateProfile  │ • getSeriesById()       │   │
│  │ • logout()   │  │ • getWatchlist  │ • searchMovies()    │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ ratingService│  │ matchService │                             │
│  │ ────────────│  │ ────────────│                             │
│  │ • getRatings │  │ • getMatches │                             │
│  │ • createRating  │ • getCompatibility  │                      │
│  │ • updateRating  │                     │                      │
│  └──────────────┘  └──────────────┘                             │
│         ↓                  ↓                  ↓                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         AXIOS INSTANCE WITH INTERCEPTORS                   │ │
│  │  • Adds JWT token to all requests                       │ │
│  │  • Adds base URL                                        │ │
│  │  • Error handling                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                        ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              CONSTANTS & CONFIGURATION                     │ │
│  │  • API_ROUTES - All endpoint URLs                      │ │
│  │  • APP_CONSTANTS - Timeouts, messages, storage keys    │ │
│  │  • VITE_API_BASE_URL - Backend URL                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │
           ↓
     🌐 NETWORK 🌐
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Express.js)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Request Processing

```
CLIENT REQUEST
      │
      ↓
┌──────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE CHAIN                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Request Logger (requestLogger)                          │  │
│  │    • Logs incoming request                               │  │
│  │    • Records timestamp and method                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 2. JSON Parser (express.json())                           │  │
│  │    • Parses req.body from JSON                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 3. CORS Middleware (cors)                                │  │
│  │    • Allows frontend to communicate               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 4. Validation Middleware (optional per route)             │  │
│  │    • Validates req.body schema                          │  │
│  │    • Returns 400 if invalid                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 5. Authentication Middleware (optional per route)         │  │
│  │    • Extracts JWT token from headers                     │  │
│  │    • Verifies token signature                           │  │
│  │    • Attaches req.user                                 │  │
│  │    • Returns 401 if unauthorized                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
└──────────────────────────────────────────────────────────────────┘
      │
      ↓
┌──────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER & CONTROLLER                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ asyncHandler wrapper                                      │  │
│  │  ├─ Executes controller function                         │  │
│  │  ├─ Catches any promise rejections                       │  │
│  │  └─ Passes errors to error handler                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│           ↓                                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ CONTROLLER LOGIC                                          │  │
│  │  ├─ Validate request parameters                          │  │
│  │  ├─ Query database (Mongoose)                            │  │
│  │  ├─ Process data                                         │  │
│  │  ├─ Return response using response helpers              │  │
│  │  │  • sendSuccess(res, data, message)                   │  │
│  │  │  • sendError(res, message, statusCode)               │  │
│  │  │  • sendPaginated(res, data, total, page, limit)      │  │
│  │  └─ Throw errors if needed (caught by asyncHandler)     │  │
│  └────────────────────────────────────────────────────────────┘  │
│           ↓                                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ HELPER UTILITIES                                          │  │
│  │  ├─ sanitizeUser() - Remove sensitive fields             │  │
│  │  ├─ getPaginationParams() - Extract page/limit           │  │
│  │  ├─ isValidMongoId() - Validate ObjectId                │  │
│  │  └─ formatError() - Consistent error format              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
      │
      ↓
┌──────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Mongoose Models                                           │  │
│  │  ├─ User           ├─ Movie          ├─ Rating           │  │
│  │  ├─ Review         ├─ Series         ├─ Notification     │  │
│  │                                                           │  │
│  │ MongoDB Atlas Database                                   │  │
│  │  └─ cleaned_db database with collections               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│                    Return Data to Controller                      │
└──────────────────────────────────────────────────────────────────┘
      │
      ↓
┌──────────────────────────────────────────────────────────────────┐
│                       RESPONSE GENERATION                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Success Response                                          │  │
│  │ {                                                         │  │
│  │   "success": true,                                       │  │
│  │   "message": "Operation successful",                     │  │
│  │   "data": { /* response data */ }                        │  │
│  │ }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
      │
      ↓
┌──────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLER MIDDLEWARE                       │
│  Catches errors from any stage of request processing:            │
│  ├─ Validation errors (400)                                     │
│  ├─ Authentication errors (401)                                 │
│  ├─ Authorization errors (403)                                  │
│  ├─ Not found errors (404)                                      │
│  ├─ Database errors (processed and formatted)                   │
│  ├─ Server errors (500)                                         │
│  └─ Returns standardized error response                         │
│     {                                                            │
│       "success": false,                                          │
│       "message": "Error description",                            │
│       "errors": [ /* detailed errors */ ]                       │
│     }                                                            │
└──────────────────────────────────────────────────────────────────┘
      │
      ↓
CLIENT RESPONSE
```

---

## API Request Route

```
Frontend Component
        │
        ↓
Use useApi() hook
        │
        ↓
Call API Service
(e.g., contentService.getMovies())
        │
        ↓
Configured Axios Instance
├─ Adds JWT token to Authorization header
├─ Sets base URL from env
├─ Adds request timeout
└─ Handles interceptors
        │
        ↓
HTTP POST/GET to Backend
(e.g., POST http://localhost:5000/api/movies)
        │
        ↓
Backend Route Handler
        │
        ↓
Request Processing Chain:
└─ Logger → CORS → Validation → Auth → Controller
        │
        ↓
Database Query
(Mongoose Models → MongoDB)
        │
        ↓
Response Generation
(sendSuccess / sendError)
        │
        ↓
Client Response Handler
├─ Check for errors
├─ Update component state
├─ Show loading/error UI
└─ Display data
```

---

## File Organization at a Glance

```
Cinephix/
│
├── 📁 backend/
│   ├── 📁 config/              Configuration
│   ├── 📁 controllers/         Business logic
│   ├── 📁 db/                  Database connection
│   ├── 📁 middleware/          ⭐ NEW: Error, Logger, Validation
│   ├── 📁 models/              Data schemas
│   ├── 📁 routes/              ⭐ NEW: Centralized route registration
│   ├── 📁 scripts/             Utilities and data scripts
│   ├── 📁 services/            Business logic services
│   ├── 📁 utils/               ⭐ NEW: Response & Helper utilities
│   ├── .env.example            ⭐ NEW: Configuration template
│   ├── server.js               Entry point
│   └── package.json
│
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── 📁 api/             ⭐ NEW: Service layer
│   │   ├── 📁 assets/          Images, logos
│   │   ├── 📁 components/      ⭐ REORGANIZED: By feature
│   │   │   ├── 📁 common/      Shared components
│   │   │   ├── 📁 auth/        Auth components
│   │   │   ├── 📁 content/     Movie/Series components
│   │   │   ├── 📁 social/      User network components
│   │   │   └── 📁 profile/     Profile components
│   │   ├── 📁 constants/       ⭐ NEW: App-wide constants
│   │   ├── 📁 context/         State management
│   │   ├── 📁 data/            Static data (genres, etc)
│   │   ├── 📁 hooks/           ⭐ NEW: Custom React hooks
│   │   ├── 📁 pages/           Page components
│   │   ├── 📁 utils/           ⭐ NEW: Helper functions
│   │   ├── App.jsx             Main component
│   │   └── main.jsx            Entry point
│   ├── .env.example            ⭐ NEW: Configuration template
│   ├── STRUCTURE_GUIDE.md       ⭐ NEW: Organization guide
│   └── package.json
│
├── 📁 cinephixUploader/       Data upload utilities
├── 📁 dataset_functions/      Data processing utilities
├── 📁 backup/                 Backup files
│
├── 📄 ARCHITECTURE.md         ⭐ NEW: Architecture guide
├── 📄 DEVELOPMENT.md          ⭐ NEW: Development guide
├── 📄 QUICK_REFERENCE.md      ⭐ NEW: Quick reference
├── 📄 REFACTORING_SUMMARY.md  ⭐ NEW: This summary
├── 📄 README.md               Project overview
└── 📄 STRUCTURE_VISUALIZATION.md  ⭐ NEW: This file

⭐ = Newly added
🔄 = Reorganized
```

---

This visualization helps understand:
1. **Data flow** from UI to database
2. **Request processing** order and error handling
3. **Complete file organization** with new additions
