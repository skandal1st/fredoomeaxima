import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          500: '#2b7fff',
          600: '#1565e6',
          700: '#1050b4',
        },
      },
    },
  },
  plugins: [],
};

export default config;
