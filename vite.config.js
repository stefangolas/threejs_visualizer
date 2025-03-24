import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/move-sphere': 'http://localhost:3000',
      '/sphere-position': 'http://localhost:3000'
    }
  },
  resolve: {
    alias: {
      'three': path.resolve(__dirname, 'node_modules/three')
    }
  }
});
