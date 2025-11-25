import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
import { marked } from 'marked';

// Custom Markdown Plugin
function markdownPlugin() {
  return {
    name: 'markdown-loader',
    transform(code, id) {
      if (!id.endsWith('.md')) return null;

      // Configure renderer to handle links
      const renderer = new marked.Renderer();

      // Override link rendering
      renderer.link = function({ href, title, text }) {
        // Check if external (starts with http or https)
        const isExternal = /^https?:\/\//.test(href);

        if (isExternal) {
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;
        }

        // Internal links (anchors)
        return `<a href="${href}" title="${title || ''}">${text}</a>`;
      };

      // Parse the markdown
      const html = marked.parse(code, { renderer });

      // Export as a JS string
      return `export default ${JSON.stringify(html)};`;
    },
  };
}


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
    markdownPlugin(),
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
