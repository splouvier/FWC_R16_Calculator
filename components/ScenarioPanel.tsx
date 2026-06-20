"use client";

import { meta } from "@/lib/teams";
import type { Fixture } from "@/lib/types";

export type Choice = "" | "home" | "draw" | "away";
export const fxKey = (f: Fixture) => `${f.home}|${f.away}`;

export default function ScenarioPanel({
  fixtures,
  choices,
  onChange,
  onReset,
  dirty,
}: {
  fixtures: Fixture[];
  choices: Record<string, Choice>;
  onChange: (key: string, c: Choice) => void;
  onReset: () => void;
  dirty: boolean;
}) {
  if (fixtures.length === 0) {
    return (
      <div className="card p-5 text-sm text-mute">
        Both teams have finished their group games — no upcoming results left to set.
      </div>
    );
  }
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="eyebrow text-[11px] text-mute">What-if · set upcoming results</div>
        {dirty && (
          <button
            onClick={onReset}
            className="text-xs display text-faint hover:text-ink transition-colors"
          >
            ↺ Reset
          </button>
        )}
      </div>
      <p className="text-xs text-faint mb-4">
        Force the outcome of a remaining group game and the whole simulation responds.
        Anything left on <span className="text-mute">Sim</span> is played out by the model.
      </p>
      <div className="space-y-3">
        {fixtures.map((f) => {
          const key = fxKey(f);
          const cur = choices[key] ?? "";
          const opts: { v: Choice; label: string }[] = [
            { v: "", label: "Sim" },
            { v: "home", label: `${meta(f.home)?.flag ?? ""} ${shortName(f.home)}` },
            { v: "draw", label: "Draw" },
            { v: "away", label: `${meta(f.away)?.flag ?? ""} ${shortName(f.away)}` },
          ];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 text-xs text-mute mb-1.5">
                <span className="eyebrow text-[10px] text-faint whitespace-nowrap">
                  Group {f.group}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {f.home} <span className="text-faint">vs</span> {f.away}
                </span>
              </div>
              <div className="glass rounded-lg p-1 grid grid-cols-4 gap-1">
                {opts.map((o) => {
                  const active = cur === o.v;
                  return (
                    <button
                      key={o.v}
                      onClick={() => onChange(key, o.v)}
                      className={`min-w-0 rounded-md py-1.5 px-1 text-xs font-medium truncate transition-colors ${
                        active
                          ? "bg-[color-mix(in_srgb,var(--accent-a)_40%,var(--panel))] text-ink"
                          : "text-faint hover:text-mute"
                      }`}
                    >
                      {o.label}
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

function shortName(name: string) {
  return name.length > 11 ? name.slice(0, 10) + "…" : name;
}
