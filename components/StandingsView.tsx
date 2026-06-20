"use client";

import { GROUP_LETTERS, GROUPS, meta } from "@/lib/teams";
import { pct } from "@/lib/api";
import type { SimResponse } from "@/lib/types";

export default function StandingsView({ data }: { data: SimResponse }) {
  return (
    <div className="rise">
      <p className="text-sm text-mute max-w-2xl mb-5">
        Live group tables and each side&apos;s simulated chance to <b className="text-ink">win
        the group</b> and to <b className="text-ink">reach the Round of 16</b>. Sorted by the
        model&apos;s order of finish.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
              <div className="space-y-1.5">
                {rows.map((r) => {
                  const accent = meta(r.name)?.primary ?? "#888";
                  return (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <span className="text-base w-6">{meta(r.name)?.flag}</span>
                      <span className="flex-1 min-w-0 truncate text-ink">{r.name}</span>
                      <span className="tnum text-xs text-faint w-14 text-right">
                        {r.s.pts}p · {r.s.gd >= 0 ? "+" : ""}
                        {r.s.gd}
                      </span>
                      <span
                        className="tnum text-xs font-semibold w-9 text-right"
                        style={{ color: accent }}
                      >
                        {pct(r.t?.groupWin ?? 0)}
                      </span>
                      <span className="tnum text-xs text-mute w-9 text-right">
                        {pct(r.t?.reachR16 ?? 0)}
                      </span>
                    </div>
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
