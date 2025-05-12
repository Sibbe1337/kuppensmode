import { defineConfig } from '@electron-forge/cli';
import { VitePlugin }  from '@electron-forge/plugin-vite';

export default defineConfig({
  packagerConfig: {
    icon: 'assets/icon',      // PNG+ICO pairs (omit ".png"/".ico" extension)
  },
  plugins: [
    new VitePlugin({
      build: [
        { // main --> bundled to dist/main.js
          buildEnd: 'electron',
          configFile: 'vite.main.config.ts',
        },
        { // renderer
          configFile: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
}); 