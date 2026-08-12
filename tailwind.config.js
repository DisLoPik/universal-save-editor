/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0e14',
          panel: '#10151f',
          raised: '#161c29',
          inset: '#080b11',
        },
        border: {
          DEFAULT: '#232a3a',
          subtle: '#1a2030',
        },
        accent: {
          DEFAULT: '#5b8cff',
          hover: '#7aa2ff',
          muted: '#2c3b63',
        },
        success: '#3ecf8e',
        warning: '#f5b74e',
        danger: '#f2555a',
        text: {
          DEFAULT: '#e6e9f0',
          muted: '#8b93a7',
          faint: '#5b6478',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
