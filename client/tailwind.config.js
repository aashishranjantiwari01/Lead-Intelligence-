/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c3d4fd',
          300: '#9ab5fb',
          400: '#6b8df7',
          500: '#4263eb',
          600: '#2f4dd8',
          700: '#253dbf',
          800: '#1e339a',
          900: '#1a2e7a',
          950: '#131f5e',
        },
        slate: {
          850: '#172033',
          950: '#0b1120',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
