import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Route-level lazy loading (see src/App.jsx) splits every page into its
    // own chunk, but it also extracts the shared third-party libraries and
    // ~200-byte lucide icons into dozens of tiny chunks. Grouping vendor code
    // into one long-lived chunk cuts the request count and lets browsers cache
    // the libraries across deploys, since app code changes far more often.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  // NOTE: no `base` override — the site is hosted at a root domain (Vercel).
  // A subpath base like '/Nexura-Portal/' makes the built index.html request
  // assets from /Nexura-Portal/assets/... which 404s on root-domain hosts.
})
