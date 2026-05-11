import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/cubism-viewer/',
  resolve: {
    alias: {
      '@framework': resolve(__dirname, '../../CubismSdkForWeb-5-r.5/Framework/src'),
    },
  },
  build: {
    outDir: '../public/cubism-viewer',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/viewer.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
