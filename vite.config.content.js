import { defineConfig } from 'vite';
import { resolve } from 'path';

// Config for the content script
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: resolve(__dirname, 'dist'),
    lib: {
      entry: resolve(__dirname, 'src/content/main.js'),
      name: 'ContentScript',
      fileName: () => 'src/content/main.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
});
