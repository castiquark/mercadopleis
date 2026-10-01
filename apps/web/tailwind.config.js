/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '420px',
      },
      colors: {
        background: '#090d16',
        surface: '#111726',
        'surface-elevated': '#1b2438',
        border: '#232f48',
        primary: {
          DEFAULT: '#0052FF', // Base Blue
          hover: '#0045d8',
          light: '#3375ff',
        },
        usdc: '#2775CA',
        accent: '#00D395',
      },
    },
  },
  plugins: [],
};
