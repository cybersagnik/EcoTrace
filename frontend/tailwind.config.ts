import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        panel: {
          DEFAULT: "rgb(var(--panel-rgb) / <alpha-value>)",
          solid: "rgb(var(--panel-solid-rgb) / <alpha-value>)",
        },
        elevated: {
          DEFAULT: "rgb(var(--elevated-rgb) / <alpha-value>)",
          hover: "rgb(var(--elevated-hover-rgb) / <alpha-value>)",
        },
        border: {
          DEFAULT: "var(--border)",
          soft: "var(--border-soft)",
          glow: "rgba(var(--border-glow-rgb), 0.25)",
        },
        text: {
          DEFAULT: "rgb(var(--text-rgb) / <alpha-value>)",
          primary: "rgb(var(--text-rgb) / <alpha-value>)",
          secondary: "rgb(var(--text-muted-rgb) / <alpha-value>)",
          muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
          tertiary: "rgb(var(--text-faint-rgb) / <alpha-value>)",
          faint: "rgb(var(--text-faint-rgb) / <alpha-value>)",
          inverse: "rgb(var(--text-inverse-rgb) / <alpha-value>)",
        },
        brand: {
          emerald: "#22C55E",
          forest: "#166534",
          sky: "#3B82F6",
          cyan: "#14B8A6",
          navy: "#0F172A",
          mint: "#DCFCE7",
        },
        status: {
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
        },
        carbon: {
          clean: "#22C55E",
          moderate: "#F59E0B",
          high: "#EF4444",
        },
        success: {
          DEFAULT: "#22C55E",
          glow: "transparent",
        },
        accent: {
          DEFAULT: "#22C55E",
          hover: "#16A34A",
          glow: "transparent",
        },
        moderate: "#F59E0B",
        high: "#EF4444",
        amber: "#F59E0B",
        blue: "#3B82F6",
        warning: "#F59E0B",
        info: "#3B82F6",
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "sans-serif"],
        body: ["Inter", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "6px",
        button: "6px",
        input: "6px",
        modal: "6px",
      },
      boxShadow: {
        sm: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
        glass: "none",
        glow: "none",
        "glow-clean": "none",
        "glow-sky": "none",
        inner: "none",
      },
      backdropBlur: {
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
        glass: "0",
      },
      transitionDuration: {
        300: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
