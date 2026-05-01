import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  appType: 'spa',
  resolve: {
    alias: {
      '@spattoo/designer': '/users/sandeep/dev/spattoo-core/src/index.js',
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
});
