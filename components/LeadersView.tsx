"use client";

import { meta, accentColor } from "@/lib/teams";
import { pct } from "@/lib/api";
import TrendArrow from "./TrendArrow";
import type { BoardEntry, SimResponse } from "@/lib/types";

export default function LeadersView({
  data,
  onPickPair,
}: {
  data: SimResponse;
  onPickPair: (a: string, b: string) => void;
}) {
  const ranked = Object.entries(data.teams)
    .map(([name, s]) => ({ name, title: s.title }))
    .sort((a, b) => b.title - a.title);
  const maxTitle = Math.max(0.0001, ranked[0]?.title ?? 0);

  return (
    <div className="rise space-y-8">
      {/* Title race */}
      <section>
        <div className="eyebrow text-[11px] text-mute mb-1">Who wins it all</div>
        <h2 className="display text-2xl mb-4">Title race</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {ranked.map((t, i) => {
            const accent = accentColor(t.name);
            return (
              <button
                key={t.name}
                onClick={() => onPickPair(t.name, ranked[(i + 1) % ranked.length].name)}
                className="group flex items-center gap-2.5 py-2 text-left rounded-lg hover:bg-[color-mix(in_srgb,var(--panel)_75%,transparent)] px-2 -mx-2 transition-colors focus-visible:bg-[color-mix(in_srgb,var(--panel)_75%,transparent)]"
                title={`Explore ${t.name} matchups`}
              >
                <RankBadge rank={i + 1} />
                <span className="text-lg w-6 text-center shrink-0">{meta(t.name)?.flag}</span>
                <span className="flex-none min-w-0 max-w-[40%] truncate text-sm text-ink">
                  {t.name}
                </span>
                <span className="flex-1 min-w-[18px] meter h-2" style={{ color: accent }}>
                  <span style={{ width: `${(t.title / maxTitle) * 100}%`, background: accent }} />
                </span>
                <span className="tnum text-xs font-semibold text-ink w-11 text-right shrink-0">
                  {pct(t.title, 1)}
                </span>
                <span className="w-9 text-right shrink-0">
                  <TrendArrow delta={data.trends?.[t.name]?.title} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dream finals */}
      <Board
        eyebrow="Dream matchups"
        title="Most likely Final"
        note="The two teams who most often reach the Final together. Tap any matchup to explore it."
        entries={data.boards.finals}
        onPickPair={onPickPair}
      />

      {/* Earliest collisions */}
      <Board
        eyebrow="On a collision course"
        title="Most likely to meet"
        note="Any knockout round — many of these are bracket neighbours destined to clash early."
        entries={data.boards.meetAnywhere}
        onPickPair={onPickPair}
      />
    </div>
  );
}

const MEDAL = ["#FFD166", "#D4DCEC", "#E0A06A"]; // gold, silver, bronze

function RankBadge({ rank }: { rank: number }) {
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

function Board({
  eyebrow,
  title,
  note,
  entries,
  onPickPair,
}: {
  eyebrow: string;
  title: string;
  note: string;
  entries: BoardEntry[];
  onPickPair: (a: string, b: string) => void;
}) {
  const max = Math.max(0.0001, ...entries.map((e) => e.prob));
  return (
    <section>
      <div className="eyebrow text-[11px] text-mute mb-1">{eyebrow}</div>
      <h2 className="display text-2xl mb-1">{title}</h2>
      <p className="text-xs text-faint mb-4 max-w-xl">{note}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((e, i) => {
          const ca = accentColor(e.a);
          const cb = accentColor(e.b);
          return (
            <button
              key={`${e.a}-${e.b}`}
              onClick={() => onPickPair(e.a, e.b)}
              className="card card-interactive relative overflow-hidden p-3 flex items-center gap-2 text-left"
            >
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(e.prob / max) * 100}%`,
                  background: `linear-gradient(90deg, ${ca}1f, ${cb}1f)`,
                }}
              />
              <span className="relative tnum text-xs text-faint w-4">{i + 1}</span>
              <span className="relative text-base">{meta(e.a)?.flag}</span>
              <span className="relative text-sm text-ink truncate">{e.a}</span>
              <span className="relative text-faint text-xs">vs</span>
              <span className="relative text-base">{meta(e.b)?.flag}</span>
              <span className="relative text-sm text-ink truncate">{e.b}</span>
              <span className="relative ml-auto tnum text-sm font-semibold text-ink">
                {pct(e.prob, 1)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
