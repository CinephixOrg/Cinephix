import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Never ship source maps: a .map file hands anyone the original,
    // unminified source and the folder structure behind it. This is Vite's
    // default for a production build — set here so it stays that way.
    sourcemap: false,
  },
  server: {
    // Lets local development call the API as same-origin "/api" (set
    // VITE_API_BASE_URL=/api in .env.development.local): no CORS setup, and
    // only this one port needs forwarding from a Codespace.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
