import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f7',
          100: '#d5ecec',
          200: '#aedada',
          300: '#7fc0c2',
          400: '#4a9fa3',
          500: '#2a8388',
          600: '#1d6b70',
          700: '#18575c',
          800: '#154549',
          900: '#133a3d',
          950: '#0a2224',
        },

        // Palette remap: the app uses raw Tailwind blue/gray/slate classes (~2000 sites).
        // Re-pointing them here re-skins every page at once; migrate to brand-* over time.
        blue: {
          50: '#eef7f7',
          100: '#d5ecec',
          200: '#aedada',
          300: '#7fc0c2',
          400: '#4a9fa3',
          500: '#2a8388',
          600: '#1d6b70',
          700: '#18575c',
          800: '#154549',
          900: '#133a3d',
          950: '#0a2224',
        },
        gray: {
          50: '#f8f7f4',
          100: '#f1efea',
          200: '#e4e1da',
          300: '#d0ccc2',
          400: '#9c988c',
          500: '#6f6c62',
          600: '#57554c',
          700: '#434139',
          800: '#2d2c26',
          900: '#1c1b17',
          950: '#11100d',
        },
        slate: {
          50: '#f3f6f6',
          100: '#e2eaea',
          200: '#c5d3d4',
          300: '#a5b9bb',
          400: '#7f9799',
          500: '#5f787b',
          600: '#3f5659',
          700: '#2b4043',
          800: '#1b3438',
          900: '#12262a',
          950: '#0b181b',
        },
        // Semantic tokens. Prefer these in new code; the palette remaps above keep
        // legacy `blue-*` / `gray-*` classes rendering the same values.
        surface: 'var(--surface)',
        'surface-sunken': 'var(--surface-sunken)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        subtle: 'var(--subtle)',
        hairline: 'var(--hairline)',
        focus: 'var(--focus)',
        success: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#ecfeff',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Segoe UI Mono', 'monospace'],
      },
      fontSize: {
        'display': ['2rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.025em' }],
        'heading': ['1.5rem', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.015em' }],
        'subheading': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['0.75rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.025em' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0.025em' }],
        'mono': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;