/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        '3270': ['"3270"', 'monospace'],
        '3270-mono': ['"3270-Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
