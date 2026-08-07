import { useTheme } from "@/lib/theme/ThemeProvider";

export const QA_PALETTE = [
  "#22C55E",
  "#F59E0B",
  "#3B82F6",
  "#14B8A6",
  "#8B5CF6",
  "#EC4899",
  "#84CC16",
  "#F97316",
  "#06B6D4",
  "#A855F7",
];

export const QA_COLORS = {
  carbon: "#22C55E",
  energy: "#F59E0B",
  cpu: "#3B82F6",
  mem: "#14B8A6",
  network: "#3B82F6",
} as const;

export function useChartTheme() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return {
    isLight,
    grid: isLight ? "rgba(0,0,0,0.06)" : "rgba(30,42,54,0.8)",
    axis: isLight ? "#475569" : "#64748b",
    axisLine: isLight ? "rgba(0,0,0,0.08)" : "#1e2a36",
    tooltipBg: isLight ? "#ffffff" : "#111720",
    tooltipBorder: isLight ? "rgba(0,0,0,0.1)" : "#1e2a36",
    tooltipText: isLight ? "#0f172a" : "#e2e8f0",
  };
}
