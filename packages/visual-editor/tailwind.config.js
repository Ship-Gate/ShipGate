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
        canvas: '#1a1a2e',
        panel: '#16213e',
        accent: '#0f3460',
        highlight: '#e94560',
        entity: '#4ade80',
        behavior: '#60a5fa',
        type: '#f472b6',
        connection: '#94a3b8',
      },
    },
  },
  plugins: [],
};
