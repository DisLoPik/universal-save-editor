import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Serves the top-level `schemas/` community-schema repository at `/schemas/*`
 * in dev, and copies it into `dist/schemas/*` at build time so a static host
 * (Cloudflare Pages, Netlify, GitHub Pages, ...) serves it as plain files.
 * This keeps the "schemas repository" a git-friendly directory tree (per the
 * project's schema-authoring workflow) while still being fetchable at runtime
 * without any server code.
 */
function schemasStaticPlugin(): Plugin {
  const schemasDir = path.resolve(__dirname, 'schemas');

  function copyDir(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  return {
    name: 'schemas-static',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const urlPath = req.url.split('?')[0];
        if (urlPath === '/schemas' || urlPath.startsWith('/schemas/')) {
          const rel = decodeURIComponent(urlPath.replace(/^\/schemas\/?/, ''));
          const filePath = path.join(schemasDir, rel);
          if (
            filePath.startsWith(schemasDir) &&
            fs.existsSync(filePath) &&
            fs.statSync(filePath).isFile()
          ) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      if (fs.existsSync(schemasDir)) {
        copyDir(schemasDir, path.resolve(__dirname, 'dist/schemas'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), schemasStaticPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
