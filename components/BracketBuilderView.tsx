"use client";

import { useMemo, useState } from "react";
import { meta, accentColor, effectiveRating, TEAMS } from "@/lib/teams";
import { pct } from "@/lib/api";
import { KO, seedR32, feedsInto, FINAL_NUM, type KMatch, type Slot } from "@/lib/bracket";
import { ROUND_LABEL, type ReachByRound, type SimResponse } from "@/lib/types";

const ROUNDS = ["R32", "R16", "QF", "SF", "F"] as const;
const NEXT_KEY: Record<string, keyof ReachByRound> = {
  R32: "R16",
  R16: "QF",
  QF: "SF",
  SF: "F",
  F: "champion",
};
const TOTAL_PICKS = 31; // 16 + 8 + 4 + 2 + 1

export default function BracketBuilderView({ data }: { data: SimResponse }) {
  const seed = useMemo(() => seedR32(data.teams), [data.teams]);
  const [picks, setPicks] = useState<Record<number, string>>({});

  const byRound = useMemo(() => {
    const r: Record<string, KMatch[]> = {};
    for (const m of KO) {
      if (!(ROUNDS as readonly string[]).includes(m.round)) continue;
      (r[m.round] ||= []).push(m);
    }
    for (const k in r) r[k].sort((a, b) => a.num - b.num);
    return r;
  }, []);

  const participant = (m: KMatch, side: "home" | "away"): string | null => {
    const f = m[side];
    if (f.type === "winner_of") return picks[f.match] ?? null;
    return seed[m.num]?.[side] ?? null;
  };

  const pick = (num: number, team: string) =>
    setPicks((prev) => {
      if (prev[num] === team) return prev; // re-tapping the same winner: no-op (don't wipe downstream)
      const next = { ...prev, [num]: team };
      let cur = feedsInto(num); // changing a result invalidates everything downstream
      while (cur != null) {
        delete next[cur];
        cur = feedsInto(cur);
      }
      return next;
    });

  // scoring vs the model
  let chalk = 0;
  let upset = 0;
  for (const m of KO) {
    const w = picks[m.num];
    if (!w || !(ROUNDS as readonly string[]).includes(m.round)) continue;
    const h = participant(m, "home");
    const a = participant(m, "away");
    if (!h || !a || !TEAMS[h] || !TEAMS[a]) continue;
    // favourite = the team the model favours (effective rating incl. host bonus)
    const fav = effectiveRating(h) >= effectiveRating(a) ? h : a;
    if (w === fav) chalk++;
    else upset++;
  }
  const made = ROUNDS.reduce(
    (n, r) => n + (byRound[r]?.filter((m) => picks[m.num]).length ?? 0),
    0,
  );
  const champion = picks[FINAL_NUM];

  return (
    <div className="rise max-w-3xl mx-auto">
      {/* summary */}
      <div className="card p-5 mb-6 sticky top-1 z-20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {champion ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <span className="text-xl">{meta(champion)?.flag}</span>
                <span className="display text-lg" style={{ color: accentColor(champion) }}>
                  {champion}
                </span>
                <span className="text-xs text-faint">
                  · model {pct(data.teams[champion]?.title ?? 0, 1)} to win it
                </span>
              </div>
            ) : (
              <div className="display text-base text-mute">
                Pick your champion — tap a team to advance them.
              </div>
            )}
            <div className="text-xs text-faint mt-1 tnum">
              {made}/{TOTAL_PICKS} picks · {chalk} with the favourite · {upset} upset
              {upset === 1 ? "" : "s"}
            </div>
          </div>
          {made > 0 && (
            <button
              onClick={() => setPicks({})}
              className="display text-xs text-faint hover:text-ink transition-colors rounded-full glass px-3 py-1.5"
            >
              ↺ Reset
            </button>
          )}
        </div>
        <p className="text-[11px] text-faint mt-2">
          Seeded with the model&apos;s projected qualifiers — change any pick and the bracket
          re-flows.
        </p>
      </div>

      {/* rounds */}
      <div className="space-y-7">
        {ROUNDS.map((r) => (
          <section key={r}>
            <div className="eyebrow text-[11px] text-mute mb-2">{ROUND_LABEL[r]}</div>
            <div className={`grid grid-cols-1 gap-2 ${r === "R32" || r === "R16" ? "sm:grid-cols-2" : ""}`}>
              {byRound[r]?.map((m) => (
                <MatchCard
                  key={m.num}
                  m={m}
                  home={participant(m, "home")}
                  away={participant(m, "away")}
                  winner={picks[m.num]}
                  onPick={(team) => pick(m.num, team)}
                  reachKey={NEXT_KEY[r]}
                  teams={data.teams}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function slotLabel(s: Slot): string {
  if (s.type === "winner_of") return `Winner of M${s.match}`;
  if (s.type === "group_1st") return `Winner ${s.group}`;
  if (s.type === "group_2nd") return `Runner-up ${s.group}`;
  if (s.type === "group_3rd") return "3rd place";
  return "TBD";
}

function MatchCard({
  m,
  home,
  away,
  winner,
  onPick,
  reachKey,
  teams,
}: {
  m: KMatch;
  home: string | null;
  away: string | null;
  winner?: string;
  onPick: (team: string) => void;
  reachKey: keyof ReachByRound;
  teams: SimResponse["teams"];
}) {
  return (
    <div className="card p-2.5">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="tnum text-[10px] font-bold text-mute">M{m.num}</span>
        <span className="text-[10px] text-faint truncate">{m.venue}</span>
      </div>
      <div className="space-y-1">
        <Chip
          name={home}
          fallback={slotLabel(m.home)}
          picked={!!winner && winner === home}
          dim={!!winner && winner !== home}
          onPick={onPick}
          model={home && teams[home] ? teams[home].reachByRound[reachKey] : undefined}
        />
        <Chip
          name={away}
          fallback={slotLabel(m.away)}
          picked={!!winner && winner === away}
          dim={!!winner && winner !== away}
          onPick={onPick}
          model={away && teams[away] ? teams[away].reachByRound[reachKey] : undefined}
        />
      </div>
    </div>
  );
}

function Chip({
  name,
  fallback,
  picked,
  dim,
  onPick,
  model,
}: {
  name: string | null;
  fallback: string;
  picked: boolean;
  dim: boolean;
  onPick: (team: string) => void;
  model?: number;
}) {
  const real = !!name && !!TEAMS[name];
  const accent = real ? accentColor(name!) : "var(--line)";
  return (
    <button
      disabled={!real}
      onClick={() => real && onPick(name!)}
      className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all ${
        real ? "cursor-pointer" : "cursor-default"
      } ${dim ? "opacity-45" : ""}`}
      style={
        picked
          ? { background: `${accent}26`, boxShadow: `inset 0 0 0 1px ${accent}` }
          : real
            ? { background: "color-mix(in srgb, var(--panel) 60%, transparent)" }
            : undefined
      }
    >
      <span className="text-base shrink-0">{real ? meta(name!)?.flag : "•"}</span>
      <span className={`flex-1 min-w-0 truncate text-sm ${real ? "text-ink" : "text-faint italic"}`}>
        {real ? name : fallback}
      </span>
      {picked && model != null && (
        <span className="tnum text-[10px] text-faint shrink-0" title="model's chance for this team">
          {pct(model, model < 0.1 ? 1 : 0)}
        </span>
      )}
      {real && !dim && !picked && (
        <span className="text-faint text-[10px] shrink-0 opacity-60">pick</span>
      )}
    </button>
  );
}
