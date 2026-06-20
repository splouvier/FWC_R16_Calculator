"use client";

import AnimatedNumber from "./AnimatedNumber";
import { meta } from "@/lib/teams";
import { ROUND_LABEL, type PairResult } from "@/lib/types";

function mostLikely(pair: PairResult) {
  let best: { round: string; venue: string; prob: number } | null = null;
  for (const [round, m] of Object.entries(pair.byRound)) {
    const topVenue = Object.entries(m.venues).sort((a, b) => b[1] - a[1])[0];
    if (!best || m.prob > best.prob) {
      best = { round, venue: topVenue?.[0] ?? "", prob: m.prob };
    }
  }
  return best;
}

export default function ResultHero({
  pair,
  accentA,
  accentB,
  loading,
}: {
  pair: PairResult;
  accentA: string;
  accentB: string;
  loading: boolean;
}) {
  const a = meta(pair.a);
  const b = meta(pair.b);
  const best = mostLikely(pair);
  const oneIn = pair.meet > 0 ? Math.round(1 / pair.meet) : null;

  return (
    <div
      className="card relative overflow-hidden p-6 sm:p-8 rise"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${accentA}26, transparent 55%), radial-gradient(120% 140% at 100% 100%, ${accentB}26, transparent 55%), linear-gradient(180deg, var(--panel), var(--panel-2))`,
      }}
    >
      <div className="flex items-center justify-center gap-3 sm:gap-5 text-center">
        <Side flag={a?.flag} name={pair.a} accent={accentA} align="right" />
        <span className="display text-faint text-lg">×</span>
        <Side flag={b?.flag} name={pair.b} accent={accentB} align="left" />
      </div>

      <div className="mt-6 text-center">
        <div className="eyebrow text-[11px] text-mute">Chance they meet in the knockouts</div>
        <div
          className={`display leading-none mt-2 tnum transition-opacity ${loading ? "opacity-40" : "opacity-100"}`}
          style={{ fontSize: "clamp(64px, 18vw, 132px)" }}
        >
          <AnimatedNumber value={pair.meet * 100} decimals={1} suffix="%" />
        </div>
        <div className="mt-2 text-mute text-sm sm:text-base">
          {oneIn ? `About a 1 in ${oneIn} shot.` : "Effectively impossible from here."}
          {best && best.prob > 0 && (
            <>
              {" "}
              Most likely in the{" "}
              <span className="text-ink font-semibold">{ROUND_LABEL[best.round]}</span>
              {best.venue && (
                <>
                  {" "}
                  at <span className="text-ink font-semibold">{best.venue}</span>
                </>
              )}
              .
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Side({
  flag,
  name,
  accent,
  align,
}: {
  flag?: string;
  name: string;
  accent: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex-1 min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="text-3xl sm:text-4xl leading-none">{flag}</div>
      <div
        className="display text-sm sm:text-lg mt-1 truncate"
        style={{ color: accent, textShadow: `0 0 24px ${accent}66` }}
      >
        {name}
      </div>
    </div>
  );
}
