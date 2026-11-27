import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const assetHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' };

export default defineConfig({
  optimizeDeps: { exclude: ['bun'] },
  ssr: { external: ['bun'] },
  plugins: [tanstackStart(), react(), nitro({
    preset: 'bun',
    routeRules: {
      '/service-worker.js': { headers: { ...assetHeaders, 'Content-Security-Policy': "default-src 'none'; connect-src 'self'" } },
      '/manifest.webmanifest': { headers: { ...assetHeaders, 'Content-Type': 'application/manifest+json; charset=utf-8' } },
      '/crew.css': { headers: assetHeaders },
      '/dialogs.js': { headers: assetHeaders },
      '/pwa.js': { headers: assetHeaders },
    },
  })],
});
