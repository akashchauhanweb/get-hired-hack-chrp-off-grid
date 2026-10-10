import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone, self-contained demo — no backend, no proxy.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
