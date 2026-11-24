/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#244C3D', 600: '#1d3e32', 50: '#eef3f0' },
        sage: { DEFAULT: '#668B70', 300: '#a8c0ae' },
        sand: { DEFAULT: '#EAE5D8', 200: '#f3f0e8' },
        ivory: '#FAF9F5',
        charcoal: { DEFAULT: '#373C36', 800: '#262a25', 900: '#1b1e1a' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        brand: ['Sora', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
