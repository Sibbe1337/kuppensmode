import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config
export default defineConfig({
  build: { 
    sourcemap: true, 
    outDir: 'dist', 
    lib: { 
      entry: 'src/main.ts', 
      formats: ['cjs'],
      fileName: 'main' // Explicitly name the output main.js
    },
    rollupOptions: {
      external: ['keytar'],
    },
  },
  plugins: [tsconfigPaths()],
}); 