import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || 3001}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://localhost:${process.env.PORT || 3001}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    cssCodeSplit: false,
    // Code splitting activé : three.js (~170 KB gzip) part dans un chunk séparé, chargé en lazy
    // uniquement quand la TV affiche la scène 3D du PMU — les téléphones ne le téléchargent jamais.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/app-[hash][extname]',
      },
    },
  },
})
