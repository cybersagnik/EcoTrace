import { CHART_VIEWBOX } from "@/constants/chart";

interface AreaChartProps {
  values: number[];
}

/**
 * Generic flat-filled area chart. TrendChart (components/dashboard)
 * is the only current consumer, wrapping this with axis labels — new
 * dashboard/analytics charts should build on this rather than hand-rolling
 * SVG again.
 */
export function AreaChart({ values }: AreaChartProps) {
  const { width, height, padding } = CHART_VIEWBOX;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const linePoints = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
  const lastPoint = linePoints.split(" ").at(-1)?.split(",").map(Number) ?? [0, 0];

  return (
    <svg
      className="block w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="trend chart"
    >
      <line x1="0" y1={height * 0.17} x2={width} y2={height * 0.17} stroke="var(--border)" strokeWidth="1" />
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="var(--border)" strokeWidth="1" />
      <line x1="0" y1={height * 0.83} x2={width} y2={height * 0.83} stroke="var(--border)" strokeWidth="1" />

      <polygon points={areaPoints} fill="var(--clean)" opacity="0.08" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--clean)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill="var(--clean)" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="8" fill="var(--clean)" opacity="0.18" />
    </svg>
  );
}
