/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api é encaminhado ao backend (mesma origem → cookies SameSite=Strict funcionam).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'], include: ['tests/**/*.test.{ts,tsx}'] },
});
