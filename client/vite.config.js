import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Forwards /api to the Express server in ../server, so no CORS setup is needed locally.
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
