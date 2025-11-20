import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/main.js'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === 'background') return 'src/background/main.js';
          return 'src/[name]/[name].js'; // Standardize output
        },
      }
    },
    minify: false,
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        const src = resolve(__dirname, 'manifest.json');
        const dest = resolve(__dirname, 'dist/manifest.json');
        copyFileSync(src, dest);
        console.log('✅ Copied manifest.json to dist folder');
      },
    },
  ],
});
