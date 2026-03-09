# Frontend Code Organization Guide

## New Folder Structure

```
frontend/src/
├── api/
│   ├── authService.js          # Auth API calls
│   ├── contentService.js       # Movies/Series API calls
│   ├── matchService.js         # Matching API calls
│   ├── ratingService.js        # Ratings API calls
│   ├── userService.js          # User API calls
│   └── axios.js                # Configured axios instance
│
├── assets/
│   ├── animations/
│   ├── cinephix_logo.png
│   └── cinephix_logo.svg
│
├── components/
│   ├── common/                 # Shared across all features
│   │   ├── LoadingSpinner.jsx
│   │   ├── StarRating.jsx
│   │   ├── ImageCropper.jsx
│   │   ├── FavoritesModal.jsx
│   │   ├── DisplayRating.jsx
│   │   └── index.js            # Export barrel
│   │
│   ├── auth/                   # Authentication related
│   │   └── (to be created as needed)
│   │
│   ├── content/                # Movie/Series display
│   │   ├── MovieCard.jsx
│   │   ├── MovieSearchBar.jsx
│   │   ├── SeriesCard.jsx
│   │   ├── SeriesSearchBar.jsx
│   │   ├── CineGraph.jsx
│   │   └── index.js            # Export barrel
│   │
│   ├── social/                 # User network/matching
│   │   ├── UserSearchCard.jsx
│   │   ├── UserRow.jsx
│   │   └── index.js            # Export barrel
│   │
│   ├── profile/                # User profiles
│   │   ├── ProfileSidebar.jsx
│   │   ├── ProfileMenu.jsx
│   │   └── index.js            # Export barrel
│   │
│   ├── TopBar.jsx              # Global navigation
│   └── index.js                # Root export barrel
│
├── constants/
│   └── apiRoutes.js            # API endpoints & app constants
│
├── context/
│   ├── AuthContext.jsx         # Authentication state
│   └── RatingsContext.jsx      # Ratings state
│
├── data/
│   ├── movieGenres.json
│   └── seriesGenres.json
│
├── hooks/                      # Custom React hooks (NEW)
│   └── index.js                # All custom hooks exported
│
├── pages/
│   ├── ContentDetailPage.jsx
│   ├── HomePage.jsx
│   ├── ListPage.jsx
│   ├── LoginPage.jsx
│   ├── MatchPage.jsx
│   ├── MoviesPage.jsx
│   ├── NetworkPage.jsx
│   ├── ProfilePage.jsx
│   ├── PublicProfilePage.jsx
│   ├── RegisterPage.jsx
│   ├── SeriesPage.jsx
│   ├── SettingsPage.jsx
│   ├── SplashScreen.jsx
│   └── WelcomePage.jsx
│
├── utils/                      # Helper functions (NEW)
│   └── index.js                # All utility functions
│
├── App.jsx                     # Main component
├── main.jsx                    # Entry point
└── index.css                   # Global styles
```

---

## Benefits of New Structure

✅ **Scalability**: Easy to add new features without cluttering components folder
✅ **Maintainability**: Clear separation of concerns
✅ **Reusability**: Barrel exports make imports cleaner
✅ **Discoverability**: Easy to find related components
✅ **Consistency**: All features follow same pattern
✅ **Testing**: Isolated concerns are easier to test

---

## How to Use New Features

### 1. Using API Services

**Before (Direct Axios)**:
```javascript
import API from '../api/axios';

const data = await API.get('/api/movies');
```

**After (Service Layer)**:
```javascript
import { contentService } from '../api/contentService';

const data = await contentService.getMovies();
```

### 2. Using Custom Hooks

```javascript
import { useApi, useDebounce, useLocalStorage } from '../hooks';
import { userService } from '../api/userService';

function ProfileComponent() {
  // Fetch user profile with automatic loading/error states
  const { data: profile, loading, error } = useApi(
    () => userService.getProfile(userId)
  );

  // Debounce search input
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Use localStorage with state management
  const [theme, setTheme] = useLocalStorage('theme', 'dark');

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {profile && <h1>{profile.username}</h1>}
    </div>
  );
}
```

### 3. Using Utility Functions

```javascript
import { truncate, isValidRating, getTMDBImageUrl } from '../utils';

function MovieCard({ movie }) {
  return (
    <div>
      <img src={getTMDBImageUrl(movie.posterPath)} alt={movie.title} />
      <p>{truncate(movie.description, 100)}</p>
      {isValidRating(movie.rating) && <span>⭐ {movie.rating}</span>}
    </div>
  );
}
```

### 4. Organizing New Components

When adding a new feature component:

1. Determine which category it belongs to:
   - **common**: Used in multiple features
   - **auth**: Authentication related
   - **content**: Movie/Series browsing
   - **social**: User network/matching
   - **profile**: User profile related

2. Create component in appropriate folder
3. Update `components/{category}/index.js` to export it
4. Import from barrel export:
   ```javascript
   import { MovieCard } from '../components/content';
   ```

---

## Component Import Examples

### Standard Imports
```javascript
// From API services
import { authService } from '../api/authService';
import { contentService } from '../api/contentService';
import { userService } from '../api/userService';
import { matchService } from '../api/matchService';
import { ratingService } from '../api/ratingService';

// From hooks
import { useApi, useDebounce, useLocalStorage } from '../hooks';

// From utilities
import { formatDate, isValidEmail, truncate } from '../utils';

// From constants
import { API_ROUTES, APP_CONSTANTS } from '../constants/apiRoutes';

// From components (using barrel exports)
import { LoadingSpinner, StarRating } from '../components/common';
import { MovieCard, SeriesCard } from '../components/content';
import { UserSearchCard } from '../components/social';
import { ProfileSidebar } from '../components/profile';
```

---

## Migration Guide

If you have existing components using old structure:

### Old Way:
```javascript
import API from '../api/axios';

useEffect(() => {
  const fetchData = async () => {
    try {
      const { data } = await API.get('http://localhost:5000/api/movies');
      setMovies(data);
    } catch (err) {
      setError(err.message);
    }
  };
  fetchData();
}, []);
```

### New Way:
```javascript
import { useApi } from '../hooks';
import { contentService } from '../api/contentService';

const { data: movies, loading, error } = useApi(
  contentService.getMovies
);
```

---

## Best Practices

1. ✅ Always use service layer for API calls
2. ✅ Use custom hooks for common patterns
3. ✅ Import from barrel exports (cleaner code)
4. ✅ Use utility functions instead of repeating logic
5. ✅ Keep components focused on UI rendering
6. ✅ Use constants from `constants/apiRoutes.js`
7. ✅ Add error handling with fallback UI

---

## Future Enhancements

- Add component PropTypes validation
- Add Storybook for component documentation
- Add component unit tests
- Add more custom hooks as patterns emerge
- Add theme context for dark/light mode
- Add notification context for toast messages
