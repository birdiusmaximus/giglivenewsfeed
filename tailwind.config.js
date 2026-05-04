/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        flame:     '#F45347',
        night:     '#0D1A2D',
        paper:     '#FEF6F6',
        dusk:      '#10273E',
        potassium: '#DEA8F4',
        copper:    '#00AE97',
        sodium:    '#FFBF3F',
      },
      fontFamily: {
        // 'motiva-sans' loads from Adobe Fonts when the Typekit link is added in app/layout.tsx.
        // Until then, Barlow (Google Fonts) is used as a close substitute.
        sans: ['motiva-sans', 'var(--font-barlow)', 'Tahoma', 'Segoe UI', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.2em',
      },
      lineClamp: {
        2: '2',
        3: '3',
      },
    },
  },
  plugins: [],
};
