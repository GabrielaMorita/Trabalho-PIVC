import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Trabalho-PIVC/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500
  }
})