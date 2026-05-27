import type { Config } from 'tailwindcss';
import { colors, radius, shadows, gradients, fontFamily, fontSize, fontWeight, transitions } from './src/styles/tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────────
      colors: {
        primary:  colors.primary,
        dark:     colors.dark,
        success:  colors.success,
        warning:  colors.warning,
        danger:   colors.danger,
        neutral:  colors.neutral,
        violet:   colors.violet,
        teal:     colors.teal,
        sky:      colors.sky,
        orange:   colors.orange,
        cyan:     colors.cyan,
        indigo:   colors.indigo,
        graphite: colors.graphite,
      },

      // ── Border Radius ────────────────────────────────────────────────────────
      borderRadius: radius,

      // ── Box Shadow ───────────────────────────────────────────────────────────
      boxShadow: shadows,

      // ── Background Image (gradients) ─────────────────────────────────────────
      backgroundImage: {
        'gradient-primary': gradients.primary,
        'gradient-surface': gradients.surface,
        'gradient-dark':    gradients.dark,
        'gradient-success': gradients.success,
      },

      // ── Typography ───────────────────────────────────────────────────────────
      fontFamily,
      fontSize:   fontSize as Config['theme']['fontSize'],
      fontWeight,

      // ── Transitions ──────────────────────────────────────────────────────────
      transitionDuration: transitions.duration,
      transitionTimingFunction: transitions.easing,
    },
  },
  plugins: [],
};

export default config;
