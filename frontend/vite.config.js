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
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            'react-bootstrap',
            'chart.js',
            'react-chartjs-2',
            '@reduxjs/toolkit',
            'react-redux',
          ],
          chart: ['chart.js', 'react-chartjs-2'],
          bootstrap: ['react-bootstrap'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
    // 청크 크기 경고 제한 조정 (선택사항)
    chunkSizeWarningLimit: 1000,
    // 코드 분할 최적화
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 콘솔 로그 제거
        drop_debugger: true,
      },
    },
  },
});
