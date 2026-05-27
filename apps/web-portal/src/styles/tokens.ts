/**
 * FOXAI Design Tokens
 *
 * Source of truth cho toàn bộ hệ thống.
 * - Import vào tailwind.config.ts để tạo utilities (bg-primary, text-danger…)
 * - Import vào component khi cần giá trị động (charts, inline style…)
 * - CSS custom properties được khai báo trong globals.css
 *
 * 5 màu chủ đạo:
 *   Primary  #2563EB  — hành động, link, trạng thái active
 *   Dark     #1E293B  — sidebar, heading, text chính
 *   Success  #059669  — thành công, hoạt động, xác nhận
 *   Warning  #D97706  — cảnh báo, chờ xử lý, highlight
 *   Danger   #E11D48  — lỗi, xóa, hành động phá hủy
 */

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  /** 1. Primary — Ocean Blue */
  primary: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',   // ← màu chủ đạo
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    DEFAULT: '#2563EB',
  },

  /** 2. Dark — Deep Slate (sidebar, heading, text đậm) */
  dark: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',   // ← màu chủ đạo
    900: '#0F172A',
    DEFAULT: '#1E293B',
  },

  /** 3. Success — Emerald (hoạt động, xác nhận, OK) */
  success: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',   // ← màu chủ đạo
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    DEFAULT: '#059669',
  },

  /** 4. Warning — Amber (cảnh báo, chờ xử lý) */
  warning: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',   // ← màu chủ đạo
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    DEFAULT: '#D97706',
  },

  /** 5. Danger — Rose (lỗi, xóa, destructive action) */
  danger: {
    50:  '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',   // ← màu chủ đạo
    700: '#BE123C',
    800: '#9F1239',
    900: '#881337',
    DEFAULT: '#E11D48',
  },

  /** Neutral — Grayscale dùng cho text, border, background */
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

  /** 6. Violet — AI, chatbot, tri thức (công nghệ, sáng tạo) */
  violet: {
    50:  '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',   // ← màu chủ đạo
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
    DEFAULT: '#7C3AED',
  },

  /** 7. Teal — OCR, xử lý tài liệu, data pipeline */
  teal: {
    50:  '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',   // ← màu chủ đạo
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
    DEFAULT: '#0D9488',
  },

  /** 8. Sky — info, trạng thái phụ, badge thứ cấp */
  sky: {
    50:  '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',   // ← màu chủ đạo
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
    DEFAULT: '#0284C7',
  },

  /** 9. Orange — thông báo, highlight nổi bật */
  orange: {
    50:  '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',   // ← màu chủ đạo
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
    DEFAULT: '#EA580C',
  },

  /** 10. Cyan — kỹ thuật số, data flow, electric highlight */
  cyan: {
    50:  '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',   // ← màu chủ đạo
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    DEFAULT: '#06B6D4',
  },

  /** 11. Indigo — electric depth, premium accent */
  indigo: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',   // ← màu chủ đạo
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
    DEFAULT: '#4F46E5',
  },

  /** 12. Graphite — near-black, đậm hơn dark-900 */
  graphite: '#111827',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
} as const;

export const fontSize = {
  xs:   ['0.75rem',  { lineHeight: '1rem' }],
  sm:   ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem',     { lineHeight: '1.5rem' }],
  lg:   ['1.125rem', { lineHeight: '1.75rem' }],
  xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
  '2xl':['1.5rem',   { lineHeight: '2rem' }],
  '3xl':['1.875rem', { lineHeight: '2.25rem' }],
} as const;

export const fontWeight = {
  normal:   '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  px:   '1px',
  0:    '0',
  0.5:  '0.125rem',  //  2px
  1:    '0.25rem',   //  4px
  1.5:  '0.375rem',  //  6px
  2:    '0.5rem',    //  8px
  2.5:  '0.625rem',  // 10px
  3:    '0.75rem',   // 12px
  3.5:  '0.875rem',  // 14px
  4:    '1rem',      // 16px
  5:    '1.25rem',   // 20px
  6:    '1.5rem',    // 24px
  8:    '2rem',      // 32px
  10:   '2.5rem',    // 40px
  12:   '3rem',      // 48px
  16:   '4rem',      // 64px
  20:   '5rem',      // 80px
  24:   '6rem',      // 96px
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  none: '0',
  xs:   '0.125rem',  //  2px
  sm:   '0.25rem',   //  4px
  DEFAULT: '0.375rem', // 6px
  md:   '0.5rem',    //  8px
  lg:   '0.75rem',   // 12px
  xl:   '1rem',      // 16px
  '2xl':'1.5rem',    // 24px
  '3xl':'1.875rem',  // 30px
  full: '9999px',
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
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
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

export const gradients = {
  primary: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
  surface: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
  dark:    'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
  success: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
} as const;

// ─── Border ───────────────────────────────────────────────────────────────────

export const border = {
  width: {
    DEFAULT: '1px',
    0:  '0',
    2:  '2px',
    4:  '4px',
  },
  color: {
    DEFAULT:  '#E2E8F0',   // neutral-200
    strong:   '#CBD5E1',   // neutral-300
    subtle:   '#F1F5F9',   // neutral-100
    primary:  '#BFDBFE',   // primary-200
    success:  '#A7F3D0',   // success-200
    warning:  '#FDE68A',   // warning-200
    danger:   '#FECDD3',   // danger-200
  },
} as const;

// ─── Z-Index ──────────────────────────────────────────────────────────────────

export const zIndex = {
  hide:     -1,
  base:      0,
  raised:   10,
  dropdown: 20,
  sticky:   30,
  overlay:  40,
  modal:    50,
  popover:  60,
  toast:    70,
  tooltip:  80,
} as const;

// ─── Transitions ──────────────────────────────────────────────────────────────

export const transitions = {
  duration: {
    'ultra-fast': '60ms',
    fast:         '100ms',
    base:         '150ms',
    slow:         '200ms',
    slower:       '300ms',
  },
  easing: {
    DEFAULT:    'cubic-bezier(0.4, 0, 0.2, 1)',
    in:         'cubic-bezier(0.4, 0, 1, 1)',
    out:        'cubic-bezier(0, 0, 0.2, 1)',
    linear:     'linear',
    spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
    'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
} as const;

// ─── Semantic aliases (dùng trong code, không phải Tailwind) ──────────────────

export const semantic = {
  // Backgrounds
  bg: {
    page:     colors.neutral[50],   // #F8FAFC — nền trang
    surface:  '#FFFFFF',            // card, modal
    subtle:   colors.neutral[100],  // section mờ
    sidebar:  colors.dark[800],     // #1E293B
    elevated: 'rgba(255, 255, 255, 0.72)',  // frosted glass card
    hover:    colors.primary[50],   // #EFF6FF — row/item hover
    active:   colors.primary[100],  // #DBEAFE — row/item active
    glass:    'rgba(255, 255, 255, 0.85)',  // strong glass
  },
  // Text
  text: {
    primary:   colors.dark[900],   // #0F172A — heading
    secondary: colors.dark[500],   // #64748B — subtext
    muted:     colors.dark[400],   // #94A3B8 — placeholder
    inverse:   '#FFFFFF',          // trên nền tối
    link:      colors.primary[600],// #2563EB
  },
  // Border
  border: {
    DEFAULT: colors.neutral[200],  // #E2E8F0
    strong:  colors.neutral[300],  // #CBD5E1
  },
  // Elevation — semantic shadow names for card states
  elevation: {
    card:         shadows.sm,
    cardHover:    shadows.md,
    cardActive:   '0 2px 6px rgba(15, 23, 42, 0.10)',
    cardSelected: shadows.glow,
  },
} as const;

// ─── Re-export tất cả ────────────────────────────────────────────────────────
export const tokens = {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  shadows,
  gradients,
  border,
  zIndex,
  transitions,
  semantic,
} as const;

export default tokens;
