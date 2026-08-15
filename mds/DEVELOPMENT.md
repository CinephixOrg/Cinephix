# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account (for image uploads)

### Installation

#### 1. Clone Repository
```bash
git clone https://github.com/furkantr18/Cinephix.git
cd Cinephix
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Start backend (development with nodemon)
npm run dev

# Or production
npm start
```

Backend will run on `http://localhost:5000`

#### 3. Frontend Setup
```bash
cd frontend
npm install

# Create .env file
cp .env.example .env

# Edit .env if needed
VITE_API_BASE_URL=http://localhost:5000/api

# Start frontend development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend will run on `http://localhost:5173`

---

## Development Workflow

### Backend Development

#### Adding a New API Endpoint

1. **Create/Update Model** (`/models`)
   ```javascript
   // models/NewItem.js
   const schema = new Schema({
     // define fields
   });
   ```

2. **Create Controller** (`/controllers`)
   ```javascript
   // controllers/newItemController.js
   import { asyncHandler } from '../middleware/errorHandler.js';
   import { sendSuccess, sendError } from '../utils/response.js';

   export const createItem = asyncHandler(async (req, res) => {
     // Your logic here
     sendSuccess(res, item, 'Item created', 201);
   });
   ```

3. **Create Route** (`/routes`)
   ```javascript
   // routes/newItemRoute.js
   import express from 'express';
   import { createItem } from '../controllers/newItemController.js';

   const router = express.Router();
   router.post('/', createItem);
   export default router;
   ```

4. **Register Route** in `routes/index.js`
   ```javascript
   app.use(`${API_PREFIX}/items`, newItemRoute);
   ```

5. **Add Middleware** if needed
   - Auth: Add `authMiddleware` to protected routes
   - Validation: Create validation rules in `middleware/validation.js`
   - Logging: Uses global `requestLogger` middleware

#### Testing Endpoints
Use Postman or REST Client (VS Code extension):

```
POST http://localhost:5000/api/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Frontend Development

#### Adding a New Page

1. **Create Page Component** (`/src/pages`)
   ```javascript
   // src/pages/NewPage.jsx
   import React, { useContext, useState, useEffect } from 'react';
   import { AuthContext } from '../context/AuthContext';
   import API from '../api/axios';

   export default function NewPage() {
     const { user } = useContext(AuthContext);

     return (
       <div>
         {/* Your page content */}
       </div>
     );
   }
   ```

2. **Add Route** in `App.jsx`
   ```javascript
   <Route 
     path="/newpage" 
     element={<ProtectedRoute><NewPage /></ProtectedRoute>} 
   />
   ```

3. **Use API Services** instead of direct calls
   ```javascript
   import { userService } from '../api/userService';

   // In component
   const profile = await userService.getProfile(userId);
   ```

#### Component Best Practices

```javascript
// Good: Use API service
import { contentService } from '../api/contentService';

function MovieCard({ movieId }) {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const data = await contentService.getMovieById(movieId);
        setMovie(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [movieId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{movie?.title}</div>;
}
```

---

## Common Tasks

### Debugging

#### Backend
- Check server logs: `npm run dev` output
- Use `console.log()` and `logger.debug()`
- MongoDB queries: Check MongoDB Atlas

#### Frontend
- Browser DevTools (F12)
- React DevTools extension
- Network tab to inspect API calls
- Store state with React DevTools

### Database Operations

#### Seed Database
```bash
cd backend
node scripts/seedData.js
```

#### Rebuild Graphs
```bash
cd backend
node scripts/rebuildCineGraphs.js
```

### Code Quality

#### Linting (Frontend)
```bash
cd frontend
npm run lint
```

---

## Troubleshooting

### Backend Issues

**"Cannot find module" error**
- Run `npm install` in backend directory
- Check import paths (case-sensitive on Linux)

**"MONGO_URI is not defined"**
- Create `.env` file in backend directory
- Copy from `.env.example`
- Verify MongoDB connection string

**"JWT_SECRET is missing"**
- Add `JWT_SECRET` to `.env`

### Frontend Issues

**"API_BASE_URL is not set"**
- Create `.env` in frontend directory
- Set `VITE_API_BASE_URL=http://localhost:5000/api`
- Restart dev server after changing .env

**Module not found errors**
- Run `npm install` in frontend directory
- Clear node_modules: `rm -rf node_modules && npm install`

**Styling issues**
- Tailwind classes not working? Restart dev server
- Check `tailwind.config.js` content paths

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/my-feature

# Create pull request on GitHub
```

---

## Performance Tips

### Backend
- Use pagination for large datasets
- Add database indexes
- Cache frequent queries with Redis (future)
- Monitor slow API endpoints

### Frontend
- Lazy load pages/components
- Use React.memo for expensive components
- Optimize images
- Minimize bundle size

---

## Deployment

### Backend (Vercel, Railway, Heroku)
```bash
# Set environment variables on platform
# Deploy automatically from GitHub
```

### Frontend (Vercel, Netlify, GitHub Pages)
```bash
# Build
npm run build

# Deploy dist/ folder
```

---

## Getting Help

- Check existing issues on GitHub
- Review code in similar controllers/components
- Read ARCHITECTURE.md for design patterns
- Check middleware for error handling patterns
