/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx,js,jsx}',
    './src/components/**/*.{ts,tsx,js,jsx}',
    './src/lib/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: ['class', '[data-theme="futuristic"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border-color)',
        foreground: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: {
          purple: '#8B5CF6',
          blue: '#38BDF8',
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 30px rgba(139, 92, 246, 0.25)',
        'glow-blue': '0 0 30px rgba(56, 189, 248, 0.25)',
        'glow-green': '0 0 24px rgba(34, 197, 94, 0.25)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.3)',
        'glow-red': '0 0 30px rgba(239, 68, 68, 0.35)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'grid-drift': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'grid-drift': 'grid-drift 20s linear infinite',
        'scan-line': 'scan-line 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
