/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        added: {
          bg: '#e6ffec',
          line: '#ccffd8',
          text: '#1a7f37',
          border: '#a7f3d0',
        },
        removed: {
          bg: '#ffebe9',
          line: '#ffd7d5',
          text: '#cf222e',
          border: '#fca5a5',
        },
        changed: {
          bg: '#fff8c5',
          line: '#fef3c7',
          text: '#9a6700',
          border: '#fcd34d',
        },
        breaking: {
          bg: '#fee2e2',
          text: '#b91c1c',
          border: '#f87171',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
