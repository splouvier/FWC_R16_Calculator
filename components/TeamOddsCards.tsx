"use client";

import AnimatedNumber from "./AnimatedNumber";
import TrendArrow from "./TrendArrow";
import { meta } from "@/lib/teams";
import { type TeamStats, type Trend } from "@/lib/types";

const EXP_LABEL = (v: number) => {
  // expRound: 0 group .. 6 champion. Map to a human label.
  const rounded = Math.round(v);
  return ["Group stage", "R32", "R16", "Quarter-final", "Semi-final", "Final", "Champions"][
    Math.max(0, Math.min(6, rounded))
  ];
};

function Stat({
  label,
  value,
  decimals = 0,
  trend,
}: {
  label: string;
  value: number;
  decimals?: number;
  trend?: number;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-line/60 last:border-0">
      <span className="text-xs text-mute">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <TrendArrow delta={trend} />
        <span className="display text-base text-ink">
          <AnimatedNumber value={value * 100} decimals={decimals} suffix="%" />
        </span>
      </span>
    </div>
  );
}

function Card({
  name,
  stats,
  accent,
  trend,
}: {
  name: string;
  stats: TeamStats;
  accent: string;
  trend?: Trend;
}) {
  const m = meta(name);
  return (
    <div
      className="card p-5 relative overflow-hidden"
      style={{ boxShadow: `0 14px 40px -24px ${accent}`, borderColor: `${accent}55` }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-2xl">{m?.flag}</span>
        <span className="display text-lg" style={{ color: accent }}>
          {name}
        </span>
        <span className="ml-auto text-[10px] eyebrow text-faint">Group {m?.group}</span>
      </div>
      <Stat label="Win the group" value={stats.groupWin} trend={trend?.groupWin} />
      <Stat label="Reach Round of 16" value={stats.reachR16} trend={trend?.reachR16} />
      <Stat label="Lift the trophy" value={stats.title} decimals={1} trend={trend?.title} />
      <div className="flex items-baseline justify-between pt-2">
        <span className="text-xs text-mute">Expected finish</span>
        <span className="display text-sm text-ink">{EXP_LABEL(stats.expRound)}</span>
      </div>
    </div>
  );
}

export default function TeamOddsCards({
  aName,
  bName,
  aStats,
  bStats,
  accentA,
  accentB,
  trends,
}: {
  aName: string;
  bName: string;
  aStats: TeamStats;
  bStats: TeamStats;
  accentA: string;
  accentB: string;
  trends?: Record<string, Trend>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card name={aName} stats={aStats} accent={accentA} trend={trends?.[aName]} />
      <Card name={bName} stats={bStats} accent={accentB} trend={trends?.[bName]} />
    </div>
  );
}
