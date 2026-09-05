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
          primary: '#0a0f14',   // deep graphite — application background
          secondary: '#131a22', // surface — panels / cards
          tertiary: '#1b2430',  // raised — hover / secondary btns
          elevated: '#222d3b',  // elevated surfaces
          border: '#2b3646',    // structural line
        },
        // Dark financial accents — financial blue
        accent: {
          primary: '#2f6bff',   // financial blue — primary action / focus
          secondary: '#4d84ff', // lighter blue — flow / node identity
          tertiary: '#6b9bff',  // tertiary blue
          hover: '#4d84ff',     // hover state (blue)
          focus: '#4d84ff',     // focus state (blue)
        },
        // Market up/down semantics (resolved per market by components)
        up: {
          DEFAULT: '#f6465d',   // red — A-share up / US-HK down
          alt: '#2ebd85',       // green
        },
        down: {
          DEFAULT: '#2ebd85',   // green — A-share down / US-HK up
          alt: '#f6465d',       // red
        },
        // Text colors for the dark theme
        text: {
          primary: '#f4f6f8',   // primary text
          secondary: '#a3aebf', // secondary text
          tertiary: '#6b7688',  // tertiary text
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
      // Dark financial typography (WS-133): Chinese body Noto Sans SC,
      // data/quotes use Inter (equal-width tabular numerals via .num/.data-value).
      fontFamily: {
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        data: ['"Inter"', '"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
      // Dark financial shadows
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(47, 107, 255, 0.28), 0 0 40px rgba(47, 107, 255, 0.10)',
        'glow-cyan-lg': '0 0 30px rgba(47, 107, 255, 0.45), 0 0 60px rgba(47, 107, 255, 0.18)',
        'glow-blue': '0 0 20px rgba(77, 132, 255, 0.25), 0 0 40px rgba(77, 132, 255, 0.08)',
        'card-dark': '0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
        'elevated-dark': '0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 10px 10px -5px rgba(0, 0, 0, 0.25)',
        'panel': '0 20px 55px rgba(0, 0, 0, 0.28)',
      },
      // Custom background images for gradients
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #0a0f14 0%, #10161e 50%, #0a0f14 100%)',
        'gradient-card': 'linear-gradient(145deg, #131a22 0%, #1b2430 100%)',
        'gradient-button': 'linear-gradient(90deg, #2f6bff 0%, #4d84ff 100%)',
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
