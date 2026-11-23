import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0b',
        panel: '#111113',
        'panel-2': '#161618',
        'panel-3': '#1c1c1f',
        edge: '#232327',
        'edge-strong': '#2e2e33',
        ink: '#e8e8ec',
        'ink-2': '#a0a0a8',
        'ink-3': '#6e6e78',
        accent: '#2f7bff',
        'accent-hover': '#4c8dff',
        'accent-soft': 'rgba(47,123,255,0.12)',
        ok: '#3fb950',
        warn: '#d29922',
        err: '#f85149',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
      },
      animation: {
        'fade-in': 'fadeIn .18s ease-out',
        'slide-up': 'slideUp .22s ease-out',
        blink: 'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
