"use client";

import { useEffect, useState } from "react";
import { meta, accentColor } from "@/lib/teams";
import { pct, simulate } from "@/lib/api";
import TrendArrow from "./TrendArrow";
import Sparkline from "./Sparkline";
import { titleSeries } from "@/lib/history";
import type { Fixture, SimResponse } from "@/lib/types";

type ScenarioRow = { label: string; groupWin: number; qualify: number };

const FUNNEL: { key: "R32" | "R16" | "QF" | "SF" | "F" | "champion"; label: string }[] = [
  { key: "R32", label: "Reach knockouts" },
  { key: "R16", label: "Round of 16" },
  { key: "QF", label: "Quarter-final" },
  { key: "SF", label: "Semi-final" },
  { key: "F", label: "Final" },
  { key: "champion", label: "Champions" },
];

export default function TeamDetail({
  data,
  team,
  onClose,
}: {
  data: SimResponse;
  team: string;
  onClose: () => void;
}) {
  const m = meta(team);
  const stats = data.teams[team];
  const standing = data.standings[team];
  const accent = accentColor(team);
  const trend = data.trends?.[team];
  const series = titleSeries(team);

  // The team's next group fixture, if any (drives the what-if scenarios).
  const next: Fixture | undefined = data.upcoming.find(
    (f) => f.home === team || f.away === team,
  );

  const [rows, setRows] = useState<ScenarioRow[] | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  useEffect(() => {
    // Async fetch of the what-if scenarios; the setState calls here are the
    // intended data-loading pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!next) {
      setRows(null);
      return;
    }
    let alive = true;
    setLoadingScenarios(true);
    const opp = next.home === team ? next.away : next.home;
    const runs: { label: string; winner: string }[] = [
      { label: "Win", winner: team },
      { label: "Draw", winner: "draw" },
      { label: "Lose", winner: opp },
    ];
    Promise.all(
      runs.map((r) =>
        simulate(team, opp, {
          forced: [{ home: next.home, away: next.away, winner: r.winner }],
        }).then((res) => ({
          label: `${r.label} vs ${opp}`,
          groupWin: res.teams[team]?.groupWin ?? 0,
          qualify: res.teams[team]?.reachR32 ?? 0,
        })),
      ),
    )
      .then((out) => alive && setRows(out))
      .finally(() => alive && setLoadingScenarios(false));
    return () => {
      alive = false;
    };
  }, [team, next]);

  const clinch = (() => {
    if (!stats) return null;
    if (stats.reachR32 >= 0.999) return "Already through to the knockouts.";
    if (stats.groupWin >= 0.999) return "Already guaranteed to win the group.";
    if (stats.reachR32 <= 0.001) return "Eliminated from contention.";
    if (rows) {
      const draw = rows.find((r) => r.label.startsWith("Draw"));
      const lose = rows.find((r) => r.label.startsWith("Lose"));
      if (draw && draw.qualify >= 0.999) return "A draw in the next game secures qualification.";
      if (lose && lose.qualify >= 0.999) return "Already certain to qualify whatever happens next.";
      const win = rows.find((r) => r.label.startsWith("Win"));
      if (win && win.groupWin >= 0.999) return "Win the next game and top the group.";
    }
    return null;
  })();

  return (
    <div
      className="card p-5 mb-6 relative overflow-hidden"
      style={{ borderColor: `${accent}66`, boxShadow: `0 18px 50px -28px ${accent}` }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">{m?.flag}</span>
        <div>
          <div className="display text-xl" style={{ color: accent }}>{team}</div>
          <div className="text-xs text-faint">
            Group {m?.group} · {standing?.pts ?? 0} pts · {standing ? `${standing.gd >= 0 ? "+" : ""}${standing.gd} GD` : ""}
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-faint hover:text-ink text-lg leading-none px-2" aria-label="Close">
          ✕
        </button>
      </div>

      {clinch && (
        <div className="text-sm mt-2 mb-3 px-3 py-2 rounded-lg" style={{ background: `${accent}1a`, color: "#f2f6ff" }}>
          {clinch}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* projection funnel */}
        <div>
          <div className="eyebrow text-[10px] text-mute mb-2">How far they go</div>
          <div className="space-y-1.5">
            {FUNNEL.map((f) => {
              const v = stats?.reachByRound?.[f.key] ?? 0;
              return (
                <div key={f.key} className="flex items-center gap-2 text-xs">
                  <span className="w-28 text-mute shrink-0">{f.label}</span>
                  <span className="flex-1 meter h-2">
                    <span style={{ width: `${Math.max(v * 100, v > 0 ? 2 : 0)}%`, background: accent }} />
                  </span>
                  <span className="tnum w-10 text-right text-ink">{pct(v, v < 0.1 ? 1 : 0)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-mute">
            <span>Win group {pct(stats?.groupWin ?? 0)}</span>
            <TrendArrow delta={trend?.groupWin} />
            <span className="mx-1">·</span>
            <span>Title {pct(stats?.title ?? 0, 1)}</span>
            <TrendArrow delta={trend?.title} />
          </div>
          {series.length >= 2 && (
            <div className="mt-3">
              <div className="eyebrow text-[10px] text-mute mb-1">Title odds over time</div>
              <Sparkline values={series} color={accent} width={150} height={36} />
            </div>
          )}
        </div>

        {/* what needs to happen */}
        <div>
          <div className="eyebrow text-[10px] text-mute mb-2">What needs to happen next</div>
          {!next ? (
            <p className="text-xs text-faint">Group games complete — qualification odds are settled above.</p>
          ) : loadingScenarios || !rows ? (
            <p className="text-xs text-faint animate-pulse">Simulating outcomes of {team} vs {next.home === team ? next.away : next.home}…</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.label} className="text-xs">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-ink">{r.label}</span>
                    <span className="text-faint">
                      qualify <span className="text-ink tnum font-semibold">{pct(r.qualify)}</span> · win grp{" "}
                      <span className="text-ink tnum font-semibold">{pct(r.groupWin)}</span>
                    </span>
                  </div>
                  <span className="meter h-1.5 block">
                    <span style={{ width: `${r.qualify * 100}%`, background: accent }} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
