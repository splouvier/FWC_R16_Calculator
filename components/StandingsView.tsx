"use client";

import { useState } from "react";
import { GROUP_LETTERS, GROUPS, meta } from "@/lib/teams";
import { pct } from "@/lib/api";
import TeamDetail from "./TeamDetail";
import type { SimResponse } from "@/lib/types";

export default function StandingsView({ data }: { data: SimResponse }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="rise">
      {selected && (
        <TeamDetail data={data} team={selected} onClose={() => setSelected(null)} />
      )}
      <p className="text-sm text-mute max-w-2xl mb-5">
        Live group tables with each side&apos;s simulated chance to <b className="text-ink">win the
        group</b> and <b className="text-ink">reach the Round of 16</b>.{" "}
        <span className="text-faint">Tap any team for full odds and what-needs-to-happen.</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {GROUP_LETTERS.map((g) => {
          const rows = GROUPS[g]
            .map((name) => ({
              name,
              s: data.standings[name] ?? { pts: 0, gf: 0, ga: 0, gd: 0 },
              t: data.teams[name],
            }))
            .sort(
              (a, b) =>
                (b.t?.groupWin ?? 0) - (a.t?.groupWin ?? 0) ||
                b.s.pts - a.s.pts ||
                b.s.gd - a.s.gd,
            );
          return (
            <div key={g} className="card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <span className="display text-lg">Group {g}</span>
                <span className="text-[10px] eyebrow text-faint">Win % · R16 %</span>
              </div>
              <div className="space-y-0.5">
                {rows.map((r, i) => {
                  const accent = meta(r.name)?.primary ?? "#888";
                  const isSel = selected === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => setSelected(isSel ? null : r.name)}
                      className={`w-full flex items-center gap-2 text-sm rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
                        isSel ? "bg-[color-mix(in_srgb,var(--accent-a)_18%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--panel)_70%,transparent)]"
                      }`}
                    >
                      <span className="tnum text-[10px] text-faint w-3 text-right shrink-0">{i + 1}</span>
                      <span className="text-base w-6 text-center shrink-0">{meta(r.name)?.flag}</span>
                      <span className="flex-1 min-w-0 truncate text-left text-ink">{r.name}</span>
                      <span className="tnum text-[11px] text-faint w-12 text-right shrink-0">
                        {r.s.pts}p {r.s.gd >= 0 ? "+" : ""}
                        {r.s.gd}
                      </span>
                      <span
                        className="tnum text-xs font-semibold w-9 text-right shrink-0"
                        style={{ color: accent }}
                      >
                        {pct(r.t?.groupWin ?? 0)}
                      </span>
                      <span className="tnum text-xs text-mute w-8 text-right shrink-0">
                        {pct(r.t?.reachR16 ?? 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
