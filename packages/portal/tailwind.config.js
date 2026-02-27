/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        sg: {
          bg: '#0a1628',
          card: '#0f1d32',
          border: '#1e3a5f',
          blue: '#58a6ff',
          green: '#238636',
          red: '#da3633',
          text1: '#e6edf3',
          text2: '#8b949e',
          text3: '#6e7681',
        },
      },
    },
  },
  plugins: [],
};
