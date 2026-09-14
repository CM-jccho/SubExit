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
        // Dark design system (말해보카 inspired)
        // bg: dark slate, surface: deeper slate, ink: light text, muted: gray-blue
        cream: {
          DEFAULT: '#0B1220', // dark slate background
          50: '#1A2332',
          100: '#0B1220',
          200: '#080E18',
          300: '#060A10',
          400: '#040608',
          500: '#020304',
        },
        ink: {
          DEFAULT: '#E8EEF7', // light text on dark
          50: '#F5F7FA',
          100: '#E8EEF7',
          200: '#D1DBE9',
          300: '#BAC8DB',
          400: '#A3B5CD',
          500: '#8B9BB4', // muted text
        },
        primary: {
          // Deep teal - NO purple, NO neon cyan
          50: '#e6f7f5',
          100: '#ccefeb',
          200: '#99dfd7',
          300: '#66cfc3',
          400: '#33bfaf',
          500: '#0D9488', // primary deep teal
          600: '#0a766d',
          700: '#085952',
          800: '#053b36',
          900: '#031e1b',
        },
        hold: {
          DEFAULT: '#0D9488',
          50: '#e6f7f5',
          100: '#ccefeb',
          200: '#99dfd7',
          300: '#66cfc3',
          400: '#33bfaf',
          500: '#0D9488',
          600: '#0a766d',
          700: '#085952',
        },
        surface: {
          DEFAULT: '#121A2A', // surface/card color
          light: '#1A2332',
          dark: '#0D1219',
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
          700: '#F43F5E',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      borderRadius: {
        '2xl': '1.25rem', // 20px - more premium
        '3xl': '1.5rem',  // 24px
      },
      boxShadow: {
        'glow': '0 0 24px rgba(13, 148, 136, 0.4)',
        'glow-sm': '0 0 12px rgba(13, 148, 136, 0.25)',
        'soft': '0 2px 12px rgba(0, 0, 0, 0.3)',
        'soft-md': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'soft-lg': '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans KR', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
