import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plain WEB build of the Flashbang UI (the same React renderer that runs inside
// Electron) so it can be hosted and opened on a phone — no React Native, no app
// store. The Electron build still uses electron.vite.config.ts; this is separate.
//   npx vite build   → dist-web/   (drag into Netlify/Cloudflare Pages)
export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
})
