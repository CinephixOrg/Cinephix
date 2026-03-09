# Quick Reference - New Code Patterns

## 1. Adding a New Feature with API Service

### Step 1: Create API Service
```javascript
// frontend/src/api/myFeatureService.js
import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const myFeatureService = {
  getItems: async (page = 1, limit = 10) => {
    try {
      const response = await API.get('/api/myfeature', {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch items' };
    }
  },

  createItem: async (itemData) => {
    try {
      const response = await API.post('/api/myfeature', itemData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create item' };
    }
  },
};

export default myFeatureService;
```

### Step 2: Create Component
```javascript
// frontend/src/components/myfeature/MyFeatureList.jsx
import { useApi } from '../../hooks';
import { myFeatureService } from '../../api/myFeatureService';
import { LoadingSpinner } from '../common';
import toast from 'react-hot-toast';

export default function MyFeatureList() {
  const { data: items, loading, error } = useApi(
    () => myFeatureService.getItems()
  );

  const handleCreate = async (itemData) => {
    try {
      await myFeatureService.createItem(itemData);
      toast.success('Created successfully!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items?.map((item) => (
        <div key={item._id}>{item.name}</div>
      ))}
    </div>
  );
}
```

---

## 2. Backend API Endpoint Pattern

```javascript
// backend/routes/myFeatureRoute.js
import express from 'express';
import { createMyFeature, getMyFeatures } from '../controllers/myFeatureController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', asyncHandler(getMyFeatures));
router.post('/', authMiddleware, asyncHandler(createMyFeature));

export default router;
```

```javascript
// backend/controllers/myFeatureController.js
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/response.js';
import MyFeatureModel from '../models/MyFeature.js';

export const getMyFeatures = asyncHandler(async (req, res) => {
  const items = await MyFeatureModel.find();
  sendSuccess(res, items, 'Features fetched successfully');
});

export const createMyFeature = asyncHandler(async (req, res) => {
  const newItem = await MyFeatureModel.create(req.body);
  sendSuccess(res, newItem, 'Feature created', 201);
});
```

---

## 3. Using Hooks in Components

### useApi - Fetch data with loading/error states
```javascript
const { data, loading, error, setData } = useApi(
  () => contentService.getMovies()
);

// data: the fetched data
// loading: boolean for loading state
// error: error message if any
// setData: manually update data
```

### useDebounce - Debounce search input
```javascript
const [searchTerm, setSearchTerm] = useState('');
const debouncedTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  // This runs 300ms after user stops typing
  const search = async () => {
    const results = await contentService.searchMovies(debouncedTerm);
    setResults(results);
  };
  search();
}, [debouncedTerm]);
```

### useLocalStorage - Persist state
```javascript
const [preferences, setPreferences] = useLocalStorage('preferences', {});

// Automatically syncs to localStorage
setPreferences({ theme: 'dark' });
```

---

## 4. Utility Function Examples

```javascript
import { 
  truncate, 
  formatDate, 
  getTMDBImageUrl,
  isValidEmail,
  isValidRating 
} from '../utils';

// Truncate text
<p>{truncate(movie.description, 100)}</p>

// Format dates
<span>{formatDate(releaseDate)}</span>

// Get image URLs
<img src={getTMDBImageUrl(posterPath)} alt={title} />

// Validate inputs
if (!isValidEmail(email)) {
  toast.error('Invalid email');
}

if (!isValidRating(rating)) {
  toast.error('Rating must be 1-10');
}
```

---

## 5. Error Handling Pattern

### Backend
```javascript
// Errors automatically caught by asyncHandler
export const myEndpoint = asyncHandler(async (req, res) => {
  const item = await MyModel.findById(req.params.id);
  
  if (!item) {
    return sendError(res, 'Item not found', 404);
  }

  sendSuccess(res, item);
});
```

### Frontend
```javascript
const handleAction = async () => {
  try {
    const result = await myService.doSomething();
    toast.success('Success!');
  } catch (error) {
    // Error handling
    const message = error.message || 'Something went wrong';
    toast.error(message);
    console.error('Detailed error:', error);
  }
};
```

---

## 6. Component Organization Template

```javascript
// frontend/src/components/myfeature/MyComponent.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useApi, useDebounce } from '../../hooks';
import { myFeatureService } from '../../api/myFeatureService';
import { truncate, formatDate } from '../../utils';
import { APP_CONSTANTS } from '../../constants/apiRoutes';
import { AuthContext } from '../../context/AuthContext';
import { LoadingSpinner } from '../common';
import toast from 'react-hot-toast';

export default function MyComponent() {
  const { user } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedTerm = useDebounce(searchTerm);

  const { data, loading, error } = useApi(() =>
    myFeatureService.getItems()
  );

  const handleAction = async (id) => {
    try {
      await myFeatureService.doAction(id);
      toast.success(APP_CONSTANTS.MESSAGES.SUCCESS.UPDATE);
    } catch (err) {
      toast.error(err.message || APP_CONSTANTS.MESSAGES.ERROR.SERVER_ERROR);
    }
  };

  if (!user) return <div>Please log in</div>;
  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      {data?.map((item) => (
        <div key={item._id}>
          <h3>{item.name}</h3>
          <p>{truncate(item.description, 50)}</p>
          <small>{formatDate(item.createdAt)}</small>
          <button onClick={() => handleAction(item._id)}>
            Action
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Constants Usage

```javascript
import { API_ROUTES, APP_CONSTANTS } from '../constants/apiRoutes';

// Using API routes
const url = API_ROUTES.MOVIES.GET_ALL;
const userUrl = API_ROUTES.USERS.GET_PROFILE(userId);

// Using app constants
const timeoutMs = APP_CONSTANTS.TIMEOUTS.API;
const maxRating = APP_CONSTANTS.MAX_RATING;
const storageKey = APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN;
const successMsg = APP_CONSTANTS.MESSAGES.SUCCESS.LOGIN;
```

---

## 8. Protected Route Pattern

```javascript
// In App.jsx
const ProtectedRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

// Usage
<Route 
  path="/dashboard"
  element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
/>
```

---

## Quick Checklist for New Features

- [ ] Create API service in `api/`
- [ ] Add endpoint constants to `constants/apiRoutes.js`
- [ ] Create component in appropriate `components/` subfolder
- [ ] Use custom hooks for common patterns
- [ ] Use utility functions for helpers
- [ ] Add error handling with `toast`
- [ ] Update barrel exports in `index.js` files
- [ ] Import from barrel exports in other components
- [ ] Test on backend and frontend
- [ ] Update documentation if needed
