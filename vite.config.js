import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Offline/standalone build (default): no Base44 plugin, no analytics/HMR notifier.
  // Set VITE_OFFLINE_MODE=false + VITE_BASE44_APP_ID to build against the Base44 backend.
  const offline = env.VITE_OFFLINE_MODE !== 'false' || !env.VITE_BASE44_APP_ID;

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [
      !offline && base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
    ].filter(Boolean),
    resolve: {
      alias: { '@': new URL('./src', import.meta.url).pathname },
    },
    build: {
      // Bundled data + three.js + leaflet push the main chunk past the default warning
      chunkSizeWarningLimit: 2000,
    },
  };
});
