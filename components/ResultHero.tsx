"use client";

import AnimatedNumber from "./AnimatedNumber";
import { meta } from "@/lib/teams";
import { ROUND_LABEL, type PairResult } from "@/lib/types";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function mostLikely(pair: PairResult) {
  let best:
    | { round: string; venue: string; date: string | null; num: number; prob: number }
    | null = null;
  for (const [round, m] of Object.entries(pair.byRound)) {
    const top = m.matches[0]; // already sorted by probability
    if (!best || m.prob > best.prob) {
      best = {
        round,
        venue: top?.venue ?? "",
        date: top?.date ?? null,
        num: top?.num ?? 0,
        prob: m.prob,
      };
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
        background: `radial-gradient(130% 150% at 0% 0%, ${accentA}33, transparent 56%), radial-gradient(130% 150% at 100% 100%, ${accentB}30, transparent 56%), linear-gradient(180deg, var(--panel-3), var(--panel-2))`,
      }}
    >
      {/* soft top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentA}, ${accentB}, transparent)` }}
      />
      <div className="flex items-center justify-center gap-3 sm:gap-5 text-center">
        <Side flag={a?.flag} name={pair.a} accent={accentA} align="right" />
        <span className="display text-faint text-lg">×</span>
        <Side flag={b?.flag} name={pair.b} accent={accentB} align="left" />
      </div>

      <div className="mt-6 text-center">
        <div className="eyebrow text-[11px]">Chance they meet in the knockouts</div>
        <div
          key={`${pair.a}-${pair.b}`}
          className={`display leading-none mt-2 tnum pop transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
          style={{
            fontSize: "clamp(64px, 18vw, 132px)",
            backgroundImage: `linear-gradient(165deg, #ffffff 30%, color-mix(in srgb, ${accentA} 45%, #ffffff) 75%, color-mix(in srgb, ${accentB} 50%, #ffffff))`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 8px 28px ${accentA}40)`,
          }}
        >
          <AnimatedNumber value={pair.meet * 100} decimals={1} suffix="%" />
        </div>
        {pair.meet > 0 && pair.meetCI != null && (
          <div className="mt-1 text-[11px] text-faint tnum">
            ± {(pair.meetCI * 100).toFixed(1)} pts (95% simulation margin)
          </div>
        )}
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
              {best.date && (
                <>
                  {" "}
                  on <span className="text-ink font-semibold">{fmtDate(best.date)}</span>
                </>
              )}
              {best.num > 0 && <span className="text-faint"> (Match {best.num})</span>}.
            </>
          )}
        </div>

        {pair.aWinIfMeet != null && (
          <div className="mt-5 max-w-md mx-auto">
            <div className="eyebrow text-[10px] text-faint mb-1.5">If they meet, who advances?</div>
            <div className="flex h-7 rounded-lg overflow-hidden border border-line">
              <div
                className="flex items-center justify-start px-2 text-[11px] font-semibold text-white"
                style={{ width: `${pair.aWinIfMeet * 100}%`, background: accentA }}
              >
                {pair.aWinIfMeet >= 0.18 && `${Math.round(pair.aWinIfMeet * 100)}%`}
              </div>
              <div
                className="flex items-center justify-end px-2 text-[11px] font-semibold text-white"
                style={{ width: `${(1 - pair.aWinIfMeet) * 100}%`, background: accentB }}
              >
                {1 - pair.aWinIfMeet >= 0.18 && `${Math.round((1 - pair.aWinIfMeet) * 100)}%`}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-mute">
              <span>{pair.a}</span>
              <span>{pair.b}</span>
            </div>
          </div>
        )}
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
