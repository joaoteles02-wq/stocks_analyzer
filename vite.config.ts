import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR desligado para evitar "piscar" no celular
      hmr: false,
      host: '0.0.0.0',
      watch: process.env.DISABLE_HMR === 'true' || process.env.DISABLE_HMR === '1'
        ? null
        : {
            ignored: ['**/user_tokens.json'],
          },
    },
  };
});
