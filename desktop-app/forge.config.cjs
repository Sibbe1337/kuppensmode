const { VitePlugin } = require('@electron-forge/plugin-vite');

/** @type {import('@electron-forge/core').ForgeConfig} */
module.exports = {
  packagerConfig: {
    icon: 'assets/icon', // Ensure you have assets/icon.png, assets/icon.ico, etc.
    // asar: true, // Default is true
  },
  rebuildConfig: {}, // Add if you have native modules
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { setupIcon: 'assets/icon.ico' } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: { options: { icon: 'assets/icon.png' } } },
    { name: '@electron-forge/maker-rpm', config: {} },
  ],
  plugins: [
    new VitePlugin({
      // `build` specifies the entry points for the main process and preload scripts.
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      // `renderer` specifies the entry points for HTML files.
      renderer: [
        {
          name: 'main_window', // Corresponds to the window name if you have multiple
          config: 'vite.renderer.config.ts', // Points to your renderer Vite config
        },
      ],
    }),
  ],
}; 