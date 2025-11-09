import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/main.js'),
        content: resolve(__dirname, 'src/content/main.js'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === 'background') return 'src/background/main.js';
          if (chunk.name === 'content') return 'src/content/main.js';
          return 'src/popup/[name].js';
        },
      },
    },
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