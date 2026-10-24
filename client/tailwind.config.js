/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rusl: {
          maroon: '#781d22',
          gold: '#c29b38',
          dark: '#1e293b',
          navy: '#0f172a',
          light: '#f8fafc',
          accent: '#0284c7'
        }
      }
    },
  },
  plugins: [],
}
