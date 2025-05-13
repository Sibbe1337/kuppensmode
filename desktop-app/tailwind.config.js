/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}", // Adjusted to scan files under src/renderer from the project root
    "./src/renderer/index.html"                // Adjusted to specifically include the main HTML from the project root
  ],
  theme: {
    extend: {
      // You can extend your theme here if needed
    },
  },
  plugins: [],
}; 