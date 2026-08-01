import { CHART_VIEWBOX } from "@/constants/chart";

interface AreaChartProps {
  values: number[];
  gradientId?: string;
}

/**
 * Generic gradient-stroked area chart. TrendChart (components/dashboard)
 * is the only current consumer, wrapping this with axis labels — new
 * dashboard/analytics charts should build on this rather than hand-rolling
 * SVG again.
 */
export function AreaChart({ values, gradientId = "areaGrad" }: AreaChartProps) {
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
      <defs>
        <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--clean)" />
          <stop offset="45%" stopColor="var(--moderate)" />
          <stop offset="75%" stopColor="var(--moderate)" />
          <stop offset="100%" stopColor="var(--clean)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--moderate)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--moderate)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1="0" y1={height * 0.17} x2={width} y2={height * 0.17} stroke="var(--border)" strokeWidth="1" />
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="var(--border)" strokeWidth="1" />
      <line x1="0" y1={height * 0.83} x2={width} y2={height * 0.83} stroke="var(--border)" strokeWidth="1" />

      <polygon points={areaPoints} fill={`url(#${gradientId}-fill)`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={`url(#${gradientId}-line)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill="var(--moderate)" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="8" fill="var(--moderate)" opacity="0.18" />
    </svg>
  );
}
