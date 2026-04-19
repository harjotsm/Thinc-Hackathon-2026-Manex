type SparkProps = {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
  /** Render as bars (Stitch-skin) instead of a polyline. */
  variant?: "line" | "bars";
};

export const Spark = ({
  data,
  color = "var(--accent, #1e40af)",
  fill = false,
  height = 22,
  variant = "line",
}: SparkProps) => {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);

  if (variant === "bars") {
    const n = data.length;
    const slot = 100 / n;
    const gap = Math.min(2, slot * 0.18);
    const w = slot - gap;
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height, width: "100%" }}
        aria-hidden
      >
        {data.map((v, i) => {
          const h = (v / max) * 92;
          const x = i * slot + gap / 2;
          const y = 100 - h - 4;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={Math.max(h, 1.5)}
              fill={color}
              opacity={v === 0 ? 0.18 : 1}
              rx={0.8}
            />
          );
        })}
      </svg>
    );
  }

  const denom = data.length === 1 ? 1 : data.length - 1;
  const pts = data.map((v, i) => `${(i / denom) * 100},${100 - (v / max) * 90 - 5}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }}>
      {fill ? (
        <polygon fill={color} opacity="0.18" points={`0,100 ${pts} 100,100`} />
      ) : null}
      <polyline fill="none" stroke={color} strokeWidth={2.5} points={pts} />
    </svg>
  );
};
