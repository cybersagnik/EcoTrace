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
          DEFAULT: "rgba(var(--panel-rgb), 0.95)",
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
          emerald: "#16A34A",
          forest: "#166534",
          sky: "#0EA5E9",
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
          glow: "rgba(34, 197, 94, 0.2)",
        },
        accent: {
          DEFAULT: "#16A34A",
          hover: "#15803D",
          glow: "rgba(22, 163, 74, 0.2)",
        },
      },
      fontFamily: {
        display: ["Inter", "Segoe UI", "sans-serif"],
        body: ["Inter", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "24px",
        button: "16px",
        input: "14px",
        modal: "28px",
      },
      boxShadow: {
        sm: "0 4px 12px rgba(15, 23, 42, 0.06)",
        md: "0 12px 40px rgba(15, 23, 42, 0.10)",
        lg: "0 24px 80px rgba(15, 23, 42, 0.15)",
        glass: "0 12px 40px rgba(15, 23, 42, 0.10)",
        glow: "0 0 24px -4px rgba(22, 163, 74, 0.25)",
        "glow-sky": "0 0 24px -4px rgba(14, 165, 233, 0.25)",
      },
      backdropBlur: {
        glass: "20px",
      },
      transitionDuration: {
        300: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
