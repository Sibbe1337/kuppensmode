    // tailwind.config.js
    /** @type {import('tailwindcss').Config} */
    module.exports = {
        content: [
          "./*.{js,ts,jsx,tsx,html}", // Scans all relevant files in the current directory (src/renderer)
          "./App.tsx", // Specifically include App.tsx
          "./index.html" // Specifically include index.html
        ],
        theme: {
          extend: {
            // You can extend your theme here if needed
          },
        },
        plugins: [],
      }