import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/chart': {
        target: 'https://api.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/chart', ''),
        secure: false,
      },
      '/accounts': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/api': 'http://backend:8000',
    },
  },
});
