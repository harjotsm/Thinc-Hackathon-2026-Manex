type SparkProps = {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
};

export const Spark = ({ data, color = "var(--accent, #1e40af)", fill = false, height = 22 }: SparkProps) => {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const denom = data.length === 1 ? 1 : data.length - 1;
  const pts = data.map((v, i) => `${(i / denom) * 100},${100 - (v / max) * 90 - 5}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }}>
      {fill ? (
        <polygon fill={color} opacity="0.18" points={`0,100 ${pts} 100,100`} />
      ) : null}
      <polyline fill="none" stroke={color} strokeWidth={2} points={pts} />
    </svg>
  );
};
