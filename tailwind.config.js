/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Slate-based dark surface palette. Text tokens below are checked
        // against these for WCAG AA contrast.
        surface: {
          900: '#0b1020',
          800: '#131a2e',
          700: '#1c2540',
          600: '#28324f',
          500: '#3a4568',
        },
        ink: {
          bright: '#f2f5ff', // on surface-900/800/700 -> >= 14:1
          normal: '#c9d2ec', // on surface-900/800     -> >= 9:1
          muted: '#94a1c4',  // on surface-900/800     -> >= 5.4:1
        },
        accent: {
          DEFAULT: '#f5b544', // MTG gold
          dark: '#3b2c07',    // text-on-accent uses surface-900 instead
        },
      },
    },
  },
  plugins: [],
}
