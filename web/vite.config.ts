import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the API is reached through this proxy, so VITE_API_URL can stay empty.
    proxy: {
      '/api': { target: 'http://127.0.0.1:4807', changeOrigin: true },
    },
  },
})
