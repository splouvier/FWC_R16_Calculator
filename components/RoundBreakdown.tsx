"use client";

import { pct } from "@/lib/api";
import { ROUND_ORDER, ROUND_LABEL, type PairResult } from "@/lib/types";

export default function RoundBreakdown({
  pair,
  accentA,
  accentB,
}: {
  pair: PairResult;
  accentA: string;
  accentB: string;
}) {
  const rounds = ROUND_ORDER.filter((r) => pair.byRound[r] && pair.byRound[r].prob > 0);
  const max = Math.max(0.0001, ...rounds.map((r) => pair.byRound[r].prob));

  if (rounds.length === 0) {
    return (
      <div className="card p-5 text-mute text-sm">
        These two can&apos;t realistically meet from the current standings.
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow text-[11px] text-mute mb-4">Where they&apos;d meet</div>
      <div className="space-y-3">
        {rounds.map((r) => {
          const m = pair.byRound[r];
          const venue = Object.entries(m.venues).sort((a, b) => b[1] - a[1])[0];
          return (
            <div key={r}>
              <div className="flex items-baseline gap-3 text-sm">
                <span className="display text-ink whitespace-nowrap">{ROUND_LABEL[r]}</span>
                <span className="flex-1 min-w-0 truncate text-faint text-xs text-right">
                  {venue ? venue[0] : ""}
                </span>
                <span className="tnum text-ink font-semibold whitespace-nowrap">{pct(m.prob, 2)}</span>
              </div>
              <div className="meter h-2 mt-1.5">
                <span
                  style={{
                    width: `${(m.prob / max) * 100}%`,
                    background: `linear-gradient(90deg, ${accentA}, ${accentB})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-faint">
        Bars are relative to their most likely meeting round. A deeper-round meeting requires
        both teams to keep winning — and to be on paths that converge there.
      </p>
    </div>
  );
}
