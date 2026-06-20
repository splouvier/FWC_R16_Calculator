"use client";

// This is an imperative requestAnimationFrame tween: driving the displayed value
// through setState across animation frames (and for the reduced-motion shortcut) is
// the intended pattern here, so the set-state-in-effect heuristic doesn't apply.
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";

/** Smoothly tweens to `value`, rendering with `decimals` places. */
export default function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  duration = 600,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return (
    <span className="tnum">
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
