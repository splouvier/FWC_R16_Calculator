"use client";

import { useEffect, useState } from "react";
import { meta } from "@/lib/teams";
import { fetchSensitivity, pct } from "@/lib/api";
import type { SensGame, SensitivityResponse } from "@/lib/types";

export default function SensitivityPanel({
  teamA,
  teamB,
}: {
  teamA: string;
  teamB: string;
}) {
  const [data, setData] = useState<SensitivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // intentional async data-loading pattern
    /* eslint-disable react-hooks/set-state-in-effect */
    const ac = new AbortController();
    setLoading(true);
    fetchSensitivity(teamA, teamB, ac.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoading(false);
      });
    return () => ac.abort();
  }, [teamA, teamB]);

  const games = data?.sensitivity ?? [];
  const maxMeet = Math.max(
    0.0001,
    ...games.flatMap((g) => g.outcomes.map((o) => o.meet)),
  );

  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow text-[11px] text-mute mb-1">Which games swing it most</div>
      <p className="text-xs text-faint mb-4">
        How much each upcoming group game moves the chance{" "}
        <span className="text-mute">{teamA}</span> and{" "}
        <span className="text-mute">{teamB}</span> meet — biggest movers first.
      </p>

      {loading ? (
        <p className="text-xs text-faint animate-pulse">Testing every outcome…</p>
      ) : games.length === 0 ? (
        <p className="text-xs text-faint">
          No upcoming group games left that move this matchup.
        </p>
      ) : (
        <div className="space-y-4">
          {games.map((g, i) => (
            <GameRow key={`${g.home}-${g.away}`} g={g} maxMeet={maxMeet} top={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function GameRow({ g, maxMeet, top }: { g: SensGame; maxMeet: number; top: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="eyebrow text-[9px] text-faint">Grp {g.group}</span>
        <span className="text-sm text-ink truncate">
          {meta(g.home)?.flag} {g.home}{" "}
          <span className="text-faint">v</span> {g.away} {meta(g.away)?.flag}
        </span>
        <span
          className="ml-auto tnum text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{
            color: top ? "#fff" : "var(--mute)",
            background: top
              ? "linear-gradient(90deg, var(--accent-a), var(--accent-b))"
              : "var(--panel-2)",
          }}
        >
          ±{(g.swing * 100).toFixed(1)} pts
        </span>
      </div>
      <div className="space-y-1">
        {g.outcomes.map((o) => {
          const label =
            o.winner === "draw"
              ? "Draw"
              : `${meta(o.winner)?.flag ?? ""} ${o.winner} win`;
          return (
            <div key={o.winner} className="flex items-center gap-2 text-xs">
              <span className="w-28 sm:w-36 truncate text-mute shrink-0">{label}</span>
              <span className="flex-1 meter h-2.5">
                <span
                  style={{
                    width: `${(o.meet / maxMeet) * 100}%`,
                    background: "linear-gradient(90deg, var(--accent-a), var(--accent-b))",
                  }}
                />
              </span>
              <span className="tnum w-10 text-right text-ink shrink-0">{pct(o.meet, 1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
