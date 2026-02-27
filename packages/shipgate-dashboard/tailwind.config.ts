import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sg: {
          bg0: '#0a0a0f',
          bg1: '#111118',
          bg2: '#1a1a24',
          bg3: '#222233',
          border: 'rgba(255,255,255,0.06)',
          'border-hover': 'rgba(255,255,255,0.12)',
          text0: '#ffffff',
          text1: '#c8c8d4',
          text2: '#8888a0',
          text3: '#555566',
          ship: '#00e68a',
          'ship-bg': 'rgba(0,230,138,0.08)',
          warn: '#ffb547',
          'warn-bg': 'rgba(255,181,71,0.08)',
          noship: '#ff5c6a',
          'noship-bg': 'rgba(255,92,106,0.08)',
          accent: '#6366f1',
          'accent-bg': 'rgba(99,102,241,0.08)',
          blue: '#38bdf8',
          'blue-bg': 'rgba(56,189,248,0.08)',
          'high-sev': '#ff8a4c',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      keyframes: {
        'ping-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'ping-ring': 'ping-ring 1.5s cubic-bezier(0,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
