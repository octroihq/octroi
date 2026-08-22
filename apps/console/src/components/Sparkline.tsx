interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** CSS color for the stroke; defaults to trend-based up/down token. */
  stroke?: string;
  strokeWidth?: number;
}

/** Deterministic inline SVG sparkline with a soft gradient fill. */
export function Sparkline({ data, width = 92, height = 26, stroke, strokeWidth = 1.5 }: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = strokeWidth;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(2)},${height} L${points[0].x.toFixed(2)},${height} Z`;

  const trendUp = data[data.length - 1] >= data[0];
  const color = stroke ?? (trendUp ? "var(--up)" : "var(--down)");
  const gid = `sg-${data.map((d) => d.toString(36)).join("").slice(0, 12)}-${width}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
