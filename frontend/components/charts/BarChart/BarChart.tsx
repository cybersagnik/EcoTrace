import { CHART_VIEWBOX } from "@/constants/chart";

interface BarChartProps {
  values: number[];
  values2?: number[];
  labels?: string[];
  color?: string;
  color2?: string;
  maxValue?: number;
}

/**
 * Custom SVG grouped/paired bar chart, built on the same sizing and CSS
 * variable conventions as AreaChart (constants/chart.ts). Supports an
 * optional secondary series (e.g. CPU + memory) rendered side-by-side.
 * When `labels` is provided the SVG grows a padded band at the bottom for
 * the x-axis labels.
 */
export function BarChart({
  values,
  values2,
  labels,
  color = "var(--clean)",
  color2 = "var(--moderate)",
  maxValue = 100,
}: BarChartProps) {
  const { width, padding } = CHART_VIEWBOX;
  const height = CHART_VIEWBOX.height + (labels?.length ? 24 : 0);
  const plotTop = 6;
  const plotBottom = labels?.length ? height - 24 : height - 6;
  const plotHeight = plotBottom - plotTop;
  const hasPair = Array.isArray(values2) && values2.length === values.length;

  const n = values.length;
  if (n === 0) return null;

  const band = (width - padding * 2) / n;
  const barGap = 2;
  const barWidth = Math.max(4, hasPair ? (band - barGap * 3) / 2 : band - barGap * 2);
  const cap = maxValue > 0 ? maxValue : 1;

  const maxLabelIdx = labels ? Math.max(0, labels.length - 1) : 0;

  return (
    <svg
      className="block w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="bar chart"
    >
      <line x1={padding} y1={plotBottom} x2={width - padding} y2={plotBottom} stroke="var(--border)" strokeWidth="1" />
      <line x1={padding} y1={plotTop + plotHeight * 0.5} x2={width - padding} y2={plotTop + plotHeight * 0.5} stroke="var(--border)" strokeWidth="1" />

      {values.map((v, i) => {
        const h = Math.max(0, (Math.min(v, cap) / cap) * plotHeight);
        const x = padding + band * i + barGap;
        const y = plotBottom - h;

        const primary = (
          <rect
            key={`p-${i}`}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx="2"
            fill={color}
            opacity={h === 0 ? 0.15 : 1}
          />
        );

        const secondary = hasPair
          ? (() => {
              const v2 = (values2 as number[])[i];
              const h2 = Math.max(0, (Math.min(v2, cap) / cap) * plotHeight);
              const x2 = x + barWidth + barGap;
              return (
                <rect
                  key={`s-${i}`}
                  x={x2}
                  y={plotBottom - h2}
                  width={barWidth}
                  height={h2}
                  rx="2"
                  fill={color2}
                  opacity={h2 === 0 ? 0.15 : 1}
                />
              );
            })()
          : null;

        const label = labels?.[Math.min(i, maxLabelIdx)]
          ? (
              <text
                key={`l-${i}`}
                x={x + (hasPair ? band : barWidth) / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-faint)"
                fontFamily="var(--font-mono, monospace)"
              >
                {labels[Math.min(i, maxLabelIdx)]}
              </text>
            )
          : null;

        return [primary, secondary, label];
      })}
    </svg>
  );
}
