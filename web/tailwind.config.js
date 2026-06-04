/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0e16',
        panel: '#0f1729',
      },
      boxShadow: {
        glow: '0 12px 40px -10px rgba(16, 185, 129, 0.45)',
        soft: '0 8px 30px -12px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pop: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        fade: 'fade 0.18s ease-out',
        pop: 'pop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
