import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/naver-stock': {
                target: 'https://m.stock.naver.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/naver-stock/, ''),
            },
            '/api/yahoo-stock': {
                target: 'https://query1.finance.yahoo.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/yahoo-stock/, ''),
            },
        },
    },
});
