/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        'km-bg': '#1e1e1e',
        'km-sidebar': '#252526',
        'km-editor': '#1e1e1e',
        'km-toolbar': '#333333',
        'km-border': '#3c3c3c',
        'km-text': '#cccccc',
        'km-text-dim': '#808080',
        'km-accent': '#007acc',
        'km-success': '#4ec9b0',
        'km-error': '#f44747',
        'km-warning': '#cca700',
      },
    },
  },
  plugins: [],
};
