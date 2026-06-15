
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        },
        fontSize: {
          'ui-xs': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
          'ui-sm': ['13px', { lineHeight: '18px' }],
          'ui-base': ['14px', { lineHeight: '20px' }],
        },
        spacing: {
          'shell': '52px',
          'rail': '52px',
          'panel': '248px',
        },
        colors: {
          surface: {
            DEFAULT: '#09090b',
            raised: '#0f0f12',
            overlay: '#18181b',
            hover: '#1c1c21',
          },
          border: {
            DEFAULT: 'rgba(255,255,255,0.08)',
            subtle: 'rgba(255,255,255,0.05)',
            strong: 'rgba(255,255,255,0.12)',
          },
          accent: {
            DEFAULT: '#6366f1',
            hover: '#818cf8',
            muted: 'rgba(99,102,241,0.12)',
            ring: 'rgba(99,102,241,0.45)',
          },
        },
        boxShadow: {
          glow: '0 0 0 1px rgba(99,102,241,0.35), 0 4px 16px -4px rgba(99,102,241,0.25)',
          card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.5)',
          float: '0 16px 48px -12px rgba(0,0,0,0.65)',
          toolbar: '0 4px 24px -4px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        },
        borderRadius: {
          '2xl': '12px',
          '3xl': '16px',
        },
        animation: {
          'fade-in': 'fadeIn 0.2s ease-out forwards',
          'fade-in-up': 'fadeInUp 0.35s ease-out forwards',
          'slide-in-left': 'slideInLeft 0.25s ease-out forwards',
          'scale-in': 'scaleIn 0.2s ease-out forwards',
          'shimmer': 'shimmer 1.6s ease-in-out infinite',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          fadeInUp: {
            '0%': { opacity: '0', transform: 'translateY(12px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          slideInLeft: {
            '0%': { opacity: '0', transform: 'translateX(-8px)' },
            '100%': { opacity: '1', transform: 'translateX(0)' },
          },
          scaleIn: {
            '0%': { opacity: '0', transform: 'scale(0.97)' },
            '100%': { opacity: '1', transform: 'scale(1)' },
          },
          shimmer: {
            '0%, 100%': { opacity: '0.5' },
            '50%': { opacity: '1' },
          },
        },
        transitionDuration: {
          DEFAULT: '200ms',
        },
        transitionTimingFunction: {
          smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
          spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        },
      },
    },
    plugins: [],
  }
