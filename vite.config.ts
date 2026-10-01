import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // maplibre-gl men-spawn worker via new URL('./maplibre-gl-worker*.mjs', import.meta.url).
    // Bila di-pre-bundle oleh esbuild, import.meta.url menunjuk bundle deps sehingga URL
    // worker 404 -> "Worker failed to load" dan peta blank putih. Exclude agar worker
    // resolve ke file dist asli.
    exclude: ['maplibre-gl'],
  },
})
