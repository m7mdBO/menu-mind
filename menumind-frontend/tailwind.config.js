/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bone: '#F4ECDC',
        cream: '#FAF6EC',
        line: '#E5DCC5',
        ink: '#141414',
        ash: '#6B5C45',
        navy: {
          DEFAULT: '#0F1B2D',
          light: '#1B2C46',
          950: '#08111E',
        },
        copper: {
          DEFAULT: '#B8531C',
          dark: '#8B3B0F',
          light: '#D26B30',
        },
        mustard: {
          DEFAULT: '#D4A024',
          light: '#E8B947',
        },
        tomato: '#C73E1D',
        sage: '#5A7A3C',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'Impact', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        ticket: '0 1px 0 rgba(15,27,45,0.08), 0 8px 24px -8px rgba(15,27,45,0.18)',
        pos: '0 2px 0 rgba(184,83,28,0.4), 0 12px 24px -8px rgba(184,83,28,0.25)',
      },
      letterSpacing: {
        signage: '0.18em',
      },
    },
  },
  plugins: [],
};
