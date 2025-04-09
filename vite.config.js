import { defineConfig } from 'vite';

export default defineConfig({
  base: '/threejs_visualizer/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
