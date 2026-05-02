/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand orange from the mockup
        brand: {
          orange: '#E8A93D',
          'orange-dark': '#D49633',
        },
        // Subtle peach background
        peach: '#FFF8EE',
      },
    },
  },
  plugins: [],
}