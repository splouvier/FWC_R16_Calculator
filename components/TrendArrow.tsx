"use client";

/**
 * Day-over-day momentum chip. `delta` is a probability change (e.g. +0.012).
 * Renders as percentage points; hidden when the move is within noise.
 */
export default function TrendArrow({
  delta,
  threshold = 0.003,
  className = "",
}: {
  delta: number | undefined;
  threshold?: number;
  className?: string;
}) {
  if (delta == null || Math.abs(delta) < threshold) return null;
  const up = delta > 0;
  const pp = Math.abs(delta * 100).toFixed(1);
  return (
    <span
      className={`tnum text-[10px] font-semibold ${className}`}
      style={{ color: up ? "#3ddc84" : "#ff6b6b" }}
      title="Change since yesterday"
    >
      {up ? "▲" : "▼"}
      {pp}
    </span>
  );
}
