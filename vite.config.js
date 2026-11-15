import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite publicar a pasta dist em qualquer subpasta (ex.: htdocs do XAMPP).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2500 },
});
