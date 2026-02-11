/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8B4513',
          50: '#fdf8f3',
          100: '#f7ebe0',
          200: '#eed4bc',
          300: '#e2b88d',
          400: '#d4955c',
          500: '#c77a3a',
          600: '#b9632f',
          700: '#8B4513',
          800: '#6d3610',
          900: '#5a2e0f',
        },
        accent: {
          DEFAULT: '#2d5016',
          light: '#4a7c2a',
        },
      },
    },
  },
  plugins: [],
};
