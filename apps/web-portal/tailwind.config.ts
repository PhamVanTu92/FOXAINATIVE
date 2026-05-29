import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────────
      colors: {
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          DEFAULT: 'var(--color-primary)',
        },
        dark: {
          50:  'var(--color-dark-50)',
          100: 'var(--color-dark-100)',
          200: 'var(--color-dark-200)',
          300: 'var(--color-dark-300)',
          400: 'var(--color-dark-400)',
          500: 'var(--color-dark-500)',
          600: 'var(--color-dark-600)',
          700: 'var(--color-dark-700)',
          800: 'var(--color-dark-800)',
          900: 'var(--color-dark-900)',
          DEFAULT: 'var(--color-dark)',
        },
        success: {
          50:  'var(--color-success-50)',
          100: 'var(--color-success-100)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
          700: 'var(--color-success-700)',
          DEFAULT: 'var(--color-success)',
        },
        warning: {
          50:  'var(--color-warning-50)',
          100: 'var(--color-warning-100)',
          500: 'var(--color-warning-500)',
          600: 'var(--color-warning-600)',
          700: 'var(--color-warning-700)',
          DEFAULT: 'var(--color-warning)',
        },
        danger: {
          50:  'var(--color-danger-50)',
          100: 'var(--color-danger-100)',
          500: 'var(--color-danger-500)',
          600: 'var(--color-danger-600)',
          700: 'var(--color-danger-700)',
          DEFAULT: 'var(--color-danger)',
        },
        neutral: {
          0:   '#FFFFFF',
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          1000:'#000000',
        },
        violet: {
          50:  'var(--color-violet-50)',
          100: 'var(--color-violet-100)',
          200: 'var(--color-violet-200)',
          500: 'var(--color-violet-500)',
          600: 'var(--color-violet-600)',
          700: 'var(--color-violet-700)',
          DEFAULT: 'var(--color-violet-600)',
        },
        teal: {
          50:  'var(--color-teal-50)',
          100: 'var(--color-teal-100)',
          200: 'var(--color-teal-200)',
          500: 'var(--color-teal-500)',
          600: 'var(--color-teal-600)',
          700: 'var(--color-teal-700)',
          DEFAULT: 'var(--color-teal-600)',
        },
        sky: {
          50:  'var(--color-sky-50)',
          100: 'var(--color-sky-100)',
          200: 'var(--color-sky-200)',
          500: 'var(--color-sky-500)',
          600: 'var(--color-sky-600)',
          700: 'var(--color-sky-700)',
          DEFAULT: 'var(--color-sky-600)',
        },
        orange: {
          50:  'var(--color-orange-50)',
          100: 'var(--color-orange-100)',
          200: 'var(--color-orange-200)',
          500: 'var(--color-orange-500)',
          600: 'var(--color-orange-600)',
          700: 'var(--color-orange-700)',
          DEFAULT: 'var(--color-orange-600)',
        },
        cyan: {
          DEFAULT: 'var(--color-cyan)',
        },
        indigo: {
          DEFAULT: 'var(--color-indigo)',
        },
        graphite: 'var(--color-graphite)',

        // Semantic Backgrounds
        sidebar:  'var(--bg-sidebar)',
        page:     'var(--bg-page)',
        surface:  'var(--bg-surface)',
        subtle:   'var(--bg-subtle)',
        elevated: 'var(--bg-elevated)',
        glass:    'var(--bg-glass)',

        // Semantic Texts
        'content-primary':   'var(--text-primary)',
        'content-secondary': 'var(--text-secondary)',
        'content-muted':     'var(--text-muted)',
        'content-inverse':   'var(--text-inverse)',
        'content-link':      'var(--text-link)',

      },

      borderColor: {
        default: 'var(--border-default)',
        strong:  'var(--border-strong)',
      },

      // ── Border Radius ────────────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        xs:   '0.125rem',
        sm:   '0.25rem',
        DEFAULT: '0.375rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl':'1.5rem',
        '3xl':'1.875rem',
        full: '9999px',
      },

      // ── Box Shadow ───────────────────────────────────────────────────────────
      boxShadow: {
        none:    'none',
        xs:      '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm:      '0 1px 2px rgba(15, 23, 42, 0.06)',
        DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
        md:      '0 4px 12px rgba(15, 23, 42, 0.08)',
        lg:      '0 10px 30px rgba(15, 23, 42, 0.12)',
        xl:      '0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)',
        '2xl':   '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner:   'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        glow:    '0 0 0 1px rgba(59, 130, 246, 0.12), 0 8px 32px rgba(37, 99, 235, 0.18)',
        'primary-sm': '0 0 0 3px rgb(37 99 235 / 0.15)',
        'danger-sm':  '0 0 0 3px rgb(225 29 72 / 0.15)',
      },

      // ── Background Image (gradients) ─────────────────────────────────────────
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
        'gradient-surface': 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        'gradient-dark':    'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        'gradient-success': 'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
      },

      // ── Typography ───────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
      },
      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      // ── Transitions ──────────────────────────────────────────────────────────
      transitionDuration: {
        'ultra-fast': '60ms',
        fast:         '100ms',
        base:         '150ms',
        slow:         '200ms',
        slower:       '300ms',
      },
      transitionTimingFunction: {
        DEFAULT:    'cubic-bezier(0.4, 0, 0.2, 1)',
        in:         'cubic-bezier(0.4, 0, 1, 1)',
        out:        'cubic-bezier(0, 0, 0.2, 1)',
        linear:     'linear',
        spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
