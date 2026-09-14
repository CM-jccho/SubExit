/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAF7F1',
          50: '#FFFFFF',
          100: '#FAF7F1',
          200: '#F5EFE3',
          300: '#EFE6D4',
          400: '#E9DDC5',
          500: '#E3D4B6',
        },
        ink: {
          DEFAULT: '#182420',
          50: '#4A5752',
          100: '#3E4A45',
          200: '#323D38',
          300: '#26302B',
          400: '#1F2723',
          500: '#182420',
        },
        hold: {
          DEFAULT: '#22C55E',
          50: '#E8F8EE',
          100: '#C6EDD8',
          200: '#A4E2C2',
          300: '#6BD199',
          400: '#3BCB76',
          500: '#22C55E',
          600: '#1B9D4B',
        },
        sway: {
          DEFAULT: '#FB7185',
          50: '#FEE9ED',
          100: '#FDD3DB',
          200: '#FCBDCA',
          300: '#FCA7B8',
          400: '#FB8C9E',
          500: '#FB7185',
          600: '#F94366',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(24, 36, 32, 0.08)',
        'soft-md': '0 4px 12px rgba(24, 36, 32, 0.12)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans KR', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
