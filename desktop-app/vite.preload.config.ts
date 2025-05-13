  // notion-lifeline/desktop-app/vite.preload.config.ts
  import { defineConfig } from 'vite';
  import tsconfigPaths from 'vite-tsconfig-paths';

  export default defineConfig({
    build: {
      outDir: 'dist',
      lib: {
        entry: 'src/preload.ts',
        formats: ['cjs'],
        fileName: 'preload'
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
    plugins: [tsconfigPaths()],
  });