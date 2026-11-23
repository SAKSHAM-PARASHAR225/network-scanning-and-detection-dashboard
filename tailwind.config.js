/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#101827',
        panelAlt: '#111c2d',
        border: '#1f2a3a',
        accent: '#38bdf8',
        secure: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#60a5fa',
        surface: '#0f172a',
        // ScanGuard design system — deep navy base, cyan primary, purple
        // secondary accent used sparingly (gradients, highlights).
        sg: {
          bg: '#020712',
          panel: '#050b14',
          surface: '#0a121f',
          border: 'rgba(94, 165, 245, 0.14)',
          borderStrong: 'rgba(94, 165, 245, 0.28)',
          cyan: '#22d3ee',
          purple: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.25)',
        glow: '0 0 24px -6px rgba(34, 211, 238, 0.35)',
        glowPurple: '0 0 24px -6px rgba(139, 92, 246, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'sg-fade': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sg-scan-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'sg-fade': 'sg-fade 320ms ease-out both',
        'sg-scan-bar': 'sg-scan-bar 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
