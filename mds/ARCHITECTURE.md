# Project Architecture Guide

## Overview
Cinephix is a full-stack MERN application for social movie matching. This document outlines the project structure and architecture best practices.

---

## Directory Structure

### Backend (`/backend`)
```
backend/
├── config/              # Configuration files
│   └── cloudinaryConfig.js
├── controllers/         # Route handlers & business logic
│   ├── matchController.js
│   ├── ratingController.js
│   ├── reviewController.js
│   └── userController.js
├── db/                  # Database connection setup
│   └── connections.js
├── middleware/          # Express middleware
│   ├── authMiddleware.js      # JWT authentication
│   ├── errorHandler.js        # Global error handling
│   ├── logger.js              # Request/response logging
│   └── validation.js          # Input validation
├── models/              # MongoDB schemas
│   ├── Movie.js
│   ├── Notification.js
│   ├── Rating.js
│   ├── Review.js
│   ├── Series.js
│   └── User.js
├── routes/              # API route definitions
│   ├── index.js               # Centralized route registration
│   ├── matchRoute.js
│   ├── movieRoute.js
│   ├── rating.js
│   ├── reviewRoutes.js
│   ├── seriesRoute.js
│   ├── userRoute.js
│   └── userWatchlistRoute.js
├── scripts/             # Utility scripts
│   ├── rebuildCineGraphs.js
│   ├── seedData.js
│   └── test_users.js
├── services/            # Business logic services
│   └── matchService.js
├── utils/               # Helper functions
│   ├── similarity.js
│   ├── helpers.js       # Common utilities
│   └── response.js      # Standardized responses
├── .env.example         # Environment variables template
├── server.js            # Entry point
└── package.json
```

### Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── api/             # API services layer
│   │   ├── axios.js          # Configured axios instance
│   │   ├── authService.js    # Authentication API calls
│   │   ├── contentService.js # Movies/Series API calls
│   │   ├── matchService.js   # Matching API calls
│   │   ├── ratingService.js  # Rating API calls
│   │   └── userService.js    # User API calls
│   ├── assets/          # Images, icons, animations
│   │   ├── animations/
│   │   ├── cinephix_logo.png
│   │   └── cinephix_logo.svg
│   ├── components/      # Reusable UI components
│   │   ├── CineGraph.jsx
│   │   ├── DisplayRating.jsx
│   │   ├── FavoritesModal.jsx
│   │   ├── ImageCropper.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── MovieCard.jsx
│   │   ├── MovieSearchBar.jsx
│   │   ├── ProfileMenu.jsx
│   │   ├── ProfileSidebar.jsx
│   │   ├── SearchBar.jsx
│   │   ├── SeriesCard.jsx
│   │   ├── SeriesSearchBar.jsx
│   │   ├── StarRating.jsx
│   │   ├── TopBar.jsx
│   │   ├── UserRow.jsx
│   │   └── UserSearchCard.jsx
│   ├── constants/       # App-wide constants
│   │   └── apiRoutes.js # API endpoints & messages
│   ├── context/         # React Context providers
│   │   ├── AuthContext.jsx
│   │   └── RatingsContext.jsx
│   ├── data/            # Static data & JSON
│   │   ├── movieGenres.json
│   │   └── seriesGenres.json
│   ├── pages/           # Page components (routes)
│   │   ├── ContentDetailPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── ListPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── MatchPage.jsx
│   │   ├── MoviesPage.jsx
│   │   ├── NetworkPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── PublicProfilePage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── SeriesPage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── SplashScreen.jsx
│   │   └── WelcomePage.jsx
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # App entry point
│   └── index.css        # Global styles
├── .env.example         # Environment variables template
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
├── eslint.config.js     # ESLint rules
└── package.json
```

---

## Architecture Patterns

### Backend Architecture

#### 1. **MVC (Model-View-Controller) Pattern**
- **Models**: MongoDB schemas in `/models`
- **Views**: JSON responses returned from controllers
- **Controllers**: Business logic in `/controllers`

#### 2. **Service Layer**
- Separates business logic from controllers
- `services/matchService.js` handles complex matching algorithms
- Improves testability and reusability

#### 3. **Middleware Stack**
```
Request → Logger → Validation → Auth → Controller → Response
         ↓
    Error Handler (catches errors from any stage)
```

#### 4. **Centralized Route Registration**
- All routes registered in `routes/index.js`
- Easy to maintain and modify API structure
- Clear documentation of all endpoints

#### 5. **Standardized Response Format**
```javascript
// Success Response
{
  success: true,
  message: "Operation successful",
  data: { /* response data */ }
}

// Error Response
{
  success: false,
  message: "Error message",
  errors: [ /* error details */ ]
}

// Paginated Response
{
  success: true,
  message: "Success",
  data: [ /* items */ ],
  pagination: {
    total: 100,
    page: 1,
    limit: 10,
    pages: 10
  }
}
```

### Frontend Architecture

#### 1. **Component-Based Structure**
- **Components**: Reusable UI building blocks
- **Pages**: Full-page components used with routing
- **Separation of concerns**: Components don't handle API calls directly

#### 2. **Service/API Layer**
- All HTTP requests go through `/api` services
- Services in `/api/authService.js`, `/api/userService.js`, etc.
- Single source of truth for API endpoint URLs
- Centralized error handling

#### 3. **Context API for State Management**
- `AuthContext.jsx`: User authentication state
- `RatingsContext.jsx`: User ratings state
- Can be expanded with additional contexts as needed

#### 4. **Constants File**
- Centralized API routes in `constants/apiRoutes.js`
- Application-wide constants (timeouts, messages, storage keys)
- Easy maintenance of endpoint URLs

#### 5. **Data Flow**
```
Component → Service Layer → Axios Instance → Backend API
                                    ↓
                         Interceptor (adds JWT token)
                                    ↓
                              Backend Handler
```

---

## Best Practices

### Backend
1. ✅ Always wrap async functions with `asyncHandler` middleware
2. ✅ Use `sanitizeUser()` before sending user objects
3. ✅ Use validation middleware for all POST/PUT requests
4. ✅ Return standardized responses using `sendSuccess()`, `sendError()`
5. ✅ Log important operations using `logger` utilities
6. ✅ Handle errors in error handler middleware, not in routes

### Frontend
1. ✅ Use API services instead of direct axios calls in components
2. ✅ Import endpoints from `constants/apiRoutes.js`
3. ✅ Always check loading and error states before rendering
4. ✅ Use environment variables for API configuration
5. ✅ Handle errors gracefully with user feedback (toasts)
6. ✅ Don't store sensitive data in localStorage without encryption

---

## Environment Setup

### Backend `.env`
```
MONGO_URI=mongodb+srv://...
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_TIMEOUT=10000
VITE_ENV=development
```

---

## API Endpoint Summary

See `backend/routes/index.js` for complete endpoint documentation.

Key endpoints:
- `POST /api/users/register` - Register user
- `POST /api/users/login` - Login
- `GET /api/movies` - List movies
- `GET /api/ratings` - Get user's ratings
- `POST /api/ratings` - Create rating
- `GET /api/match/suggestions` - Get match suggestions

---

## Database Models

### User
- username, email, password (hashed)
- bio, profile_pic_url
- followers, following (array of user IDs)
- watchlist (array of { itemId, itemType, addedAt })

### Movie/Series
- TMDB data (title, description, genres, ratings, etc.)
- Custom fields as needed

### Rating
- userId, contentId, contentType
- ratingValue, timestamp

### Review
- userId, contentId, reviewText
- timestamp, likes

### Notification
- userId, type, message, read status

---

## Future Improvements

1. **Real-time Updates**: Add WebSocket support for live notifications
2. **Redis Caching**: Cache frequently accessed data
3. **Search Optimization**: Implement Elasticsearch
4. **Testing**: Add Jest/Mocha test suites
5. **API Documentation**: Add Swagger/OpenAPI documentation
6. **Rate Limiting**: Implement API rate limiting
7. **Monitoring**: Add error tracking (Sentry)
