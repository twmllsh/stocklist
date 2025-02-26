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
        secure: false,
        ws: true,
      },
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-core': [
            'react',
            'react-dom',
            'react-router-dom',
            'react-bootstrap',
            '@reduxjs/toolkit',
            'react-redux',
          ],
          'vendor-chart': ['chart.js', 'react-chartjs-2'],
        },
      },
    },
    // 청크 크기 경고 제한 조정 (선택사항)
    chunkSizeWarningLimit: 1000,
    // 코드 분할 최적화
    minify: 'esbuild', // terser 대신 esbuild 사용
    esbuild: {
      drop: ['console', 'debugger'], // console.log와 debugger 제거
    },
  },
});
