"use client";

import { useMemo } from "react";
import { meta, accentColor } from "@/lib/teams";
import { getAwards, type Scorer, type TeamStat } from "@/lib/awards";

const MEDAL = ["#FFD166", "#D4DCEC", "#E0A06A"];

function Rank({ rank }: { rank: number }) {
  if (rank <= 3) {
    const c = MEDAL[rank - 1];
    return (
      <span
        className="tnum text-[11px] font-bold w-5 h-5 grid place-items-center rounded-full shrink-0"
        style={{ color: "#0a0f1c", background: c, boxShadow: `0 0 10px -2px ${c}` }}
      >
        {rank}
      </span>
    );
  }
  return <span className="tnum text-xs text-faint w-5 text-center shrink-0">{rank}</span>;
}

export default function AwardsView() {
  const awards = useMemo(() => getAwards(), []);
  const topScorerGoals = awards.scorers[0]?.goals ?? 1;

  return (
    <div className="rise space-y-9">
      <p className="text-sm text-mute max-w-2xl">
        Live award races from the goals recorded so far —{" "}
        <b className="text-ink">{awards.totalGoals} goals</b> across{" "}
        <b className="text-ink">{awards.matchesPlayed} matches</b>.
      </p>

      {/* Golden Boot */}
      <section>
        <div className="eyebrow text-[11px] text-mute mb-1">👟 Top scorers</div>
        <h2 className="display text-2xl mb-4" style={{ color: "#FFD166" }}>
          Golden Boot race
        </h2>
        {awards.scorers.length === 0 ? (
          <p className="text-sm text-faint">No goals recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {awards.scorers.slice(0, 20).map((s, i) => (
              <ScorerRow key={s.name} s={s} rank={i + 1} max={topScorerGoals} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <TeamBoard
          eyebrow="⚽ Attack"
          title="Most goals"
          rows={awards.teamGoals.slice(0, 10)}
          suffix="scored"
        />
        <TeamBoard
          eyebrow="🧤 Defence"
          title="Fewest conceded"
          rows={awards.teamDefense.slice(0, 10)}
          suffix="against"
          lowGood
        />
      </div>

      <p className="text-xs text-faint">
        Own goals are excluded from the Golden Boot. Data updates as matches are played.
      </p>
    </div>
  );
}

function ScorerRow({ s, rank, max }: { s: Scorer; rank: number; max: number }) {
  const accent = accentColor(s.team);
  return (
    <div className="flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg">
      <Rank rank={rank} />
      <span className="text-lg w-6 text-center shrink-0">{meta(s.team)?.flag}</span>
      <span className="min-w-0 flex-none max-w-[46%]">
        <span className="block truncate text-sm text-ink">{s.name}</span>
        <span className="block truncate text-[10px] text-faint">{s.team}</span>
      </span>
      <span className="flex-1 min-w-[14px] meter h-2" style={{ color: accent }}>
        <span style={{ width: `${(s.goals / max) * 100}%`, background: accent }} />
      </span>
      <span className="tnum text-sm font-bold text-ink w-4 text-right shrink-0">{s.goals}</span>
      {s.pens > 0 && (
        <span className="text-[9px] text-faint shrink-0" title={`${s.pens} from the spot`}>
          {s.pens}P
        </span>
      )}
    </div>
  );
}

function TeamBoard({
  eyebrow,
  title,
  rows,
  suffix,
  lowGood,
}: {
  eyebrow: string;
  title: string;
  rows: TeamStat[];
  suffix: string;
  lowGood?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section>
      <div className="eyebrow text-[11px] text-mute mb-1">{eyebrow}</div>
      <h2 className="display text-xl mb-3">{title}</h2>
      <div className="space-y-1">
        {rows.map((r, i) => {
          const accent = accentColor(r.team);
          // for "fewest conceded", invert the bar so a short bar = best
          const w = lowGood ? (1 - r.value / max) * 90 + 10 : (r.value / max) * 100;
          return (
            <div key={r.team} className="flex items-center gap-2.5 text-sm py-1">
              <span className="tnum text-xs text-faint w-4 text-right shrink-0">{i + 1}</span>
              <span className="text-base w-6 text-center shrink-0">{meta(r.team)?.flag}</span>
              <span className="flex-none min-w-0 max-w-[42%] truncate text-ink">{r.team}</span>
              <span className="flex-1 min-w-[14px] meter h-2" style={{ color: accent }}>
                <span style={{ width: `${w}%`, background: accent }} />
              </span>
              <span className="tnum text-sm font-semibold text-ink w-5 text-right shrink-0">
                {r.value}
              </span>
              <span className="text-[10px] text-faint shrink-0 hidden sm:inline">{suffix}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
