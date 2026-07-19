/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        editorial: ['Lora', 'Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        // ---- Narraza brand tokens (design.md §9) ----
        brand: {
          50: '#FFF5F8',
          100: '#FCE6EE',
          200: '#F7C6D6',
          300: '#EF91AF',
          400: '#E35F88',
          500: '#D34875',
          600: '#C13F6B',
          700: '#A62F59',
          800: '#842644',
          900: '#641E35',
        },
        ink: {
          950: '#24171E',
          800: '#3A2931',
          700: '#4A3A42',
          500: '#76656D',
          300: '#A9979F',
        },
        line: {
          200: '#E8DCE1',
          100: '#F1E8EC',
        },
        surface: '#FFFFFF',
        canvas: '#FFF9F6',
        'surface-soft': '#F8F1F4',
        success: { 50: '#EDF8F3', 700: '#267455' },
        warning: { 50: '#FFF5E8', 700: '#A55E18' },
        danger: { 50: '#FFF0F2', 700: '#B83A4B' },
        info: { 50: '#EFF5FD', 700: '#3D6FB4' },
        amber: { 500: '#D98B3F' },
        plum: { 600: '#6F4B68' },
        // ---- shadcn compatibility (mapped to Narraza via CSS vars) ----
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(36, 23, 30, 0.06)',
        md: '0 8px 24px rgba(36, 23, 30, 0.08)',
        lg: '0 18px 48px rgba(36, 23, 30, 0.12)',
        focus: '0 0 0 3px rgba(239, 145, 175, 0.55)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
