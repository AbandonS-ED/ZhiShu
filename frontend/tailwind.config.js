/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 模板色彩系统（code.html :root）—— 米色+暖灰+墨黑+琥珀
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        surface: 'var(--surface)',
        'surface-glass': 'var(--surface-glass)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        warm: 'var(--warm)',
        'warm-soft': 'var(--warm-soft)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        info: 'var(--info)',
        'info-soft': 'var(--info-soft)',

        // 兼容老 shadcn 颜色变量（避免破坏 cn() 工具）
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f5f3f0',
          100: '#eceae6',
          200: '#d8d4cd',
          300: '#bfb9af',
          400: '#9a9490',
          500: '#5c5751',
          600: '#3d3934',
          700: '#2b2924',
          800: '#1a1816',
          900: '#0f0e0c',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'var(--warm)',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        // 模板圆角（更克制）
        lg: '14px',
        md: '10px',
        sm: '10px',
        xs: '7px',
      },
      fontFamily: {
        // 模板字体：Inter（无衬线）+ Newsreader（衬线标题）+ JetBrains Mono
        // Google Fonts 在国内不可达，全部用本地字体回退
        sans: ['var(--font-geist-sans)', 'Inter', '-apple-system', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.03)',
        sm: '0 2px 8px rgba(0,0,0,0.04)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.04)',
        md: '0 8px 30px rgba(0,0,0,0.06)',
        lg: '0 20px 60px rgba(0,0,0,0.08)',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-out': 'cubic-bezier(0.33, 1, 0.68, 1)',
      },
    },
  },
  plugins: [],
}
