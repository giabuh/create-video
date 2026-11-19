import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = import.meta.dirname;
const repo = path.resolve(here, '..');
const api = `http://127.0.0.1:${process.env.REEL_API_PORT ?? 5316}`;
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {'@studio': path.join(repo, 'studio/src')},
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/media', '@remotion/google-fonts', '@remotion/player'],
  },
  server: {
    port: Number(process.env.REEL_UI_PORT ?? 5317), strictPort: true, host: '127.0.0.1',
    fs: {allow: [here, path.join(repo, 'studio'), path.join(repo, 'node_modules')]}, // not the whole repo: config.json etc. must not be readable via /@fs
    // '/library' and '/voices' are also SPA routes: proxy only paths with a file part below the root (prefix keys would swallow the pages)
    proxy: {'/api': {target: api}, '^/(library|music|sfx|brands|projects|voices)/': {target: api}},
  },
});
