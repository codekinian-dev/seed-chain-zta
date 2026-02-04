import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F9B8E',
          50: '#E5F8F4',
          100: '#C9F0E7',
          200: '#93E1D0',
          300: '#5CD1B8',
          400: '#26C2A1',
          500: '#0F9B8E',
          600: '#0C7A6F',
          700: '#08574E',
          800: '#05352F',
          900: '#021814',
        },
        ocean: {
          DEFAULT: '#0E4F82',
          50: '#E3F0FA',
          100: '#C7E0F4',
          200: '#8FBFE8',
          300: '#579EDE',
          400: '#1E7CD2',
          500: '#0E4F82',
          600: '#0B4069',
          700: '#083050',
          800: '#052137',
          900: '#02121F',
        },
        sunshine: {
          DEFAULT: '#F7C843',
          50: '#FFFAE8',
          100: '#FFF2C2',
          200: '#FFE38A',
          300: '#FFD452',
          400: '#FFC325',
          500: '#F7C843',
          600: '#D19F14',
          700: '#A4790F',
          800: '#78540B',
          900: '#4B3206',
        },
        forest: '#0B3B2E',
        surface: '#F4F9F7',
        ink: '#14212B',
      },
      boxShadow: {
        soft: '0 20px 45px -20px rgba(15, 155, 142, 0.35)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms()],
}

