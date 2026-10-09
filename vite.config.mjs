import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: process.env.VITE_HOSTED === 'true' ? '/365-days/projects/day-004/' : '/', plugins: [react()], build: { outDir: 'dist' } });
