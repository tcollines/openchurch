/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        church: {
          // Open Church design language (Manifest-style): deep forest ink + lime accent
          forest: '#0F2418', // ink — dark surfaces, primary text on lime
          forestLight: '#1A3526',
          emerald: '#2F6B0A', // accent as text on light surfaces
          emeraldDark: '#1F4A06',
          lime: '#A3E635',
          limeHover: '#93D42A',
          limeSoft: '#F1F9E6',
          limeLine: '#D9EDBF',
          gold: '#C9F08A',
          canvas: '#F2F3EF',
          card: '#FFFFFF',
          soft: '#F6F7F3',
          field: '#FAFBF8',
          line: '#ECEEE9',
          border: '#E2E5DF',
          text: '#18231C',
          muted: '#5C655E',
          faint: '#9AA39B',
          pos: '#116B43',
          posSoft: '#DDF1E4',
          warn: '#A15C00',
          warnSoft: '#FCEFD9',
          neg: '#B42318',
          negSoft: '#FBE1DF',
          mist: '#A9B8AC',
        },
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Figtree', 'system-ui', 'sans-serif'],
        mono: ['Outfit', 'Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '22px',
      },
    },
  },
  plugins: [],
};
