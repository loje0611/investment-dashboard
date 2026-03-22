/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Premium Deep Navy overriding default indigo
        indigo: {
          50: '#f4f6f8',
          100: '#e4ebf3',
          200: '#c8d6e3',
          300: '#a3bed3',
          400: '#7a9fbb',
          500: '#5a82a0',
          600: '#41637f', // Base primary
          700: '#355068',
          800: '#2e4458',
          900: '#293a4c',
          950: '#1a2634',
        },
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        }
      },
      boxShadow: {
        'glass-sm': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
        'glass-lg': '0 12px 48px 0 rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
