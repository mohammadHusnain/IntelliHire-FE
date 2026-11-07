import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // In development the browser talks to this origin and Vite forwards /api and /media to Django,
  // so no CORS setup is needed. Override with DEV_API_TARGET when the backend runs elsewhere.
  const target = env.DEV_API_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy: {
        '/api': { target, changeOrigin: false },
        '/media': { target, changeOrigin: false },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      // Same origin as the API stub, like the dev proxy: jsdom enforces CORS for XMLHttpRequest uploads.
      environmentOptions: { jsdom: { url: 'http://api.test/' } },
      globals: true,
      setupFiles: './src/test/setup.js',
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
      restoreMocks: true,
      // Absolute so Node's fetch (no browser origin) can reach the MSW handlers.
      env: { VITE_API_URL: 'http://api.test/api', VITE_USE_MOCK_API: 'false' },
    },
  }
})
