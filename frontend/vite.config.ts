import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'restart-on-tailwind-config-change',
      configureServer(server) {
        const twConfig = path.resolve(__dirname, 'tailwind.config.js');
        server.watcher.add(twConfig);
        server.watcher.on('change', (file) => {
          if (path.normalize(file) === path.normalize(twConfig)) {
            server.restart();
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

