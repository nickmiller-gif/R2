import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0faf4',
          100: '#dcf5e4',
          200: '#bbebcb',
          300: '#88d9a8',
          400: '#4fbf7e',
          500: '#2aa35d',
          600: '#1d844a',
          700: '#196a3c',
          800: '#175431',
          900: '#13452a',
          950: '#082718',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          muted: '#555555',
          faint: '#999999',
        },
        surface: {
          DEFAULT: '#fafaf8',
          raised: '#ffffff',
          sunken: '#f0ede8',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
