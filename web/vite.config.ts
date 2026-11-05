import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * En développement, /api est relayé vers l'API Express (npm run dev -w api).
 *
 * 127.0.0.1 et non « localhost » : depuis Node 17, « localhost » se résout d'abord en
 * IPv6 (::1) sous Windows et sur certains Linux, alors que l'API écoute en IPv4
 * (0.0.0.0) ; le proxy échouait alors avec ECONNREFUSED et Vite répondait 500.
 */
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000';

const apiProxy: Record<string, ProxyOptions> = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
    configure(proxy) {
      // API arrêtée ou injoignable : une erreur JSON lisible par le front, pas une 500 vide.
      proxy.on('error', (error, _req, res) => {
        if (!('writeHead' in res) || res.headersSent) return;
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: {
              code: 'api_unreachable',
              message: `API injoignable sur ${API_TARGET} : lancer « npm run dev » (${error.message})`,
            },
          }),
        );
      });
    },
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
