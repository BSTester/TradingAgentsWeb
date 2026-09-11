/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Workflow Desk — a precise research instrument.
      // Deep blue-black surfaces, mint for the decisive action / current stage,
      // sky blue for structural flow, amber/red for warning/error.
      colors: {
        // Dark surfaces (mapped 1:1 onto the prior semantic tokens so the whole
        // app re-skins without per-file edits).
       dark: {
          primary: '#060a10',   // ink — deep finance base
          secondary: '#0e1620', // surface — panels / cards
          tertiary: '#16202d',  // raised — hover / secondary btns
          elevated: '#1d2937',  // elevated surfaces
          border: '#243243',    // structural line
          input: '#0a1119',     // recessed inputs
          rail: '#0b131c',      // side rail
          hover: '#1a2636',     // generic hover
        },
        // Workflow Desk accents
        accent: {
          primary: '#9ee5c9',   // mint — bull / primary action / success
          secondary: '#81bbed', // sky blue — safe / flow / info
          tertiary: '#5fb6e8',  // tertiary blue
          hover: '#9ee5c9',     // hover state (mint)
          focus: '#8acbff',     // focus state (blue)
        },
        // Verdict / stance semantic palette for the research report
        verdict: {
          bull: '#9ee5c9',      // 看多 / 买入 / 积极
          hold: '#e5bd72',      // 持有 / 审慎 / 中性偏多
          bear: '#f48b8b',      // 看空 / 减持 / 偏空
          safe: '#81bbed',      // Safe / 稳健 / 信息
          neutral: '#9aa9b8',   // 中性
        },
        // Text colors for the dark theme
        text: {
          primary: '#f1f5f7',   // primary text
          secondary: '#9aa9b8', // secondary text
          tertiary: '#68798a',  // tertiary text
          muted: '#4a5568',     // muted text
        },
        // Keep existing color schemes for compatibility
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#3ddc97',      // Workflow Desk mint-family success
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ff6b81',      // Workflow Desk red-family danger
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#ffc66c',      // Workflow Desk amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#8acbff',      // Workflow Desk blue
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      // Workflow Desk typography
     fontFamily: {
       sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        // Noto Serif SC for Chinese financial headlines (authoritative, editorial)
        serif: ['"Noto Serif SC"', '"Songti SC"', 'ui-serif', 'Georgia', '"Times New Roman"', 'serif'],
        // Tabular monospace for tickers / prices / verdicts / confidence
        mono: ['"DM Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        num: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        heading: ['"Noto Serif SC"', '"Noto Sans SC"', 'ui-serif', 'Georgia', 'serif'],
     },
      // Bootstrap-compatible spacing
      spacing: {
        '0.5': '0.125rem', // 2px
        '1': '0.25rem',    // 4px
        '1.5': '0.375rem', // 6px
        '2': '0.5rem',     // 8px
        '2.5': '0.625rem', // 10px
        '3': '0.75rem',    // 12px
        '3.5': '0.875rem', // 14px
        '4': '1rem',       // 16px
        '5': '1.25rem',    // 20px
        '6': '1.5rem',     // 24px
        '7': '1.75rem',    // 28px
        '8': '2rem',       // 32px
        '9': '2.25rem',    // 36px
        '10': '2.5rem',    // 40px
        '11': '2.75rem',   // 44px
        '12': '3rem',      // 48px
        // Mobile-specific spacing
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        'touch': '2.75rem', // 44px - minimum touch target
        'rail': '15.5rem',  // 248px - desktop research rail width
      },
      // Bootstrap-compatible font sizes
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      // Bootstrap-compatible border radius
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      // Workflow Desk shadows
      boxShadow: {
        // Name kept as glow-cyan so existing utilities keep working; value is now mint-tinted.
        'glow-cyan': '0 0 20px rgba(155, 255, 190, 0.28), 0 0 40px rgba(155, 255, 190, 0.10)',
        'glow-cyan-lg': '0 0 30px rgba(155, 255, 190, 0.45), 0 0 60px rgba(155, 255, 190, 0.18)',
        'glow-blue': '0 0 20px rgba(138, 203, 255, 0.25), 0 0 40px rgba(138, 203, 255, 0.08)',
        'card-dark': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        'elevated-dark': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        'panel': '0 20px 55px rgba(0, 0, 0, 0.22)',
      },
      // Custom background images for gradients
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #0a0d12 0%, #111720 50%, #0a0d12 100%)',
        'gradient-card': 'linear-gradient(145deg, #111720 0%, #171f2b 100%)',
        'gradient-button': 'linear-gradient(90deg, #9bffbe 0%, #8acbff 100%)',
        'gradient-radial': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
      },
      // Custom animations
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 3s ease-in-out',
        'spin-reverse': 'spin-reverse 1s linear infinite',
        'workflow-in': 'workflow-in 0.22s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(155, 255, 190, 0.28), 0 0 40px rgba(155, 255, 190, 0.10)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(155, 255, 190, 0.45), 0 0 60px rgba(155, 255, 190, 0.18)',
          },
        },
        'shimmer': {
          '0%': {
            backgroundPosition: '-1000px 0',
          },
          '100%': {
            backgroundPosition: '1000px 0',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-10px)',
          },
        },
        'spin-reverse': {
          'from': {
            transform: 'rotate(360deg)',
          },
          'to': {
            transform: 'rotate(0deg)',
          },
        },
        'workflow-in': {
          '0%': { opacity: '0', transform: 'translateY(7px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      // Custom backdrop blur
      backdropBlur: {
        'xs': '2px',
      },
      // Mobile-specific utilities
      minHeight: {
        'touch': '44px',
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minWidth: {
        'touch': '44px',
      },
      maxWidth: {
        'mobile': '640px',
        'tablet': '1024px',
      },
    },
  },
  plugins: [],
}
