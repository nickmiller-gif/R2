/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        border: 'var(--color-border)',
        'border-hover': 'var(--color-border-hover)',
        muted: 'var(--color-muted)',
        hint: 'var(--color-hint)',
        fg: 'var(--color-fg)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'Courier New', 'monospace'],
        ui: ['var(--font-ui)', '-apple-system', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      letterSpacing: {
        label: '0.2em',
        wide: '0.08em',
        wordmark: '0.22em',
      },
      fontSize: {
        label: ['10px', { lineHeight: '1.4', letterSpacing: '0.2em' }],
        body: ['12px', { lineHeight: '1.6', letterSpacing: '0.08em' }],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
