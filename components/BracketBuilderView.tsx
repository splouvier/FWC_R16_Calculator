"use client";

import { useEffect, useMemo, useState } from "react";
import { meta, accentColor, effectiveRating, TEAMS } from "@/lib/teams";
import { pct } from "@/lib/api";
import {
  KO,
  seedR32,
  modelPicks,
  feedsInto,
  encodePicks,
  decodePicks,
  FINAL_NUM,
  type KMatch,
  type Slot,
} from "@/lib/bracket";
import { liveBracket, anyLiveResults } from "@/lib/live";
import { ROUND_LABEL, type ReachByRound, type SimResponse } from "@/lib/types";

const ROUNDS = ["R32", "R16", "QF", "SF", "F"] as const;
const NEXT_KEY: Record<string, keyof ReachByRound> = {
  R32: "R16",
  R16: "QF",
  QF: "SF",
  SF: "F",
  F: "champion",
};
const TOTAL_PICKS = 31;

type Mode = "build" | "model" | "live";

function slotLabel(s: Slot): string {
  if (s.type === "winner_of") return `Winner of M${s.match}`;
  if (s.type === "group_1st") return `Winner ${s.group}`;
  if (s.type === "group_2nd") return `Runner-up ${s.group}`;
  if (s.type === "group_3rd") return "3rd place";
  return "TBD";
}

export default function BracketBuilderView({ data }: { data: SimResponse }) {
  const seed = useMemo(() => seedR32(data.teams), [data.teams]);
  const model = useMemo(() => modelPicks(seed), [seed]);
  const live = useMemo(() => liveBracket(), []);
  const hasLive = useMemo(() => anyLiveResults(), []);

  const [mode, setMode] = useState<Mode>("build");
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  // restore a shared bracket from the URL
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("bracket");
    if (b) {
      const p = decodePicks(b);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Object.keys(p).length) setPicks(p);
    }
  }, []);
  // keep ?bracket in the URL so a reload / Share captures the current picks
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const enc = encodePicks(picks);
    if (enc) sp.set("bracket", enc);
    else sp.delete("bracket");
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [picks]);

  const byRound = useMemo(() => {
    const r: Record<string, KMatch[]> = {};
    for (const m of KO) {
      if (!(ROUNDS as readonly string[]).includes(m.round)) continue;
      (r[m.round] ||= []).push(m);
    }
    for (const k in r) r[k].sort((a, b) => a.num - b.num);
    return r;
  }, []);

  const partFromPicks = (m: KMatch, side: "home" | "away", pk: Record<number, string>) => {
    const f = m[side];
    if (f.type === "winner_of") return pk[f.match] ?? null;
    return seed[m.num]?.[side] ?? null;
  };

  const pick = (num: number, team: string) =>
    setPicks((prev) => {
      if (prev[num] === team) return prev;
      const next = { ...prev, [num]: team };
      let cur = feedsInto(num);
      while (cur != null) {
        delete next[cur];
        cur = feedsInto(cur);
      }
      return next;
    });

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  // per-match view model for the active mode
  const view = (m: KMatch) => {
    if (mode === "live") {
      const lm = live[m.num];
      return {
        home: lm?.real1 ? lm.team1 : null,
        away: lm?.real2 ? lm.team2 : null,
        winner: lm?.winner ?? null,
        score: lm?.score ?? null,
        interactive: false,
        divergent: false,
      };
    }
    const pk = mode === "model" ? model : picks;
    const winner = pk[m.num] ?? null;
    return {
      home: partFromPicks(m, "home", pk),
      away: partFromPicks(m, "away", pk),
      winner,
      score: null as string | null,
      interactive: mode === "build",
      divergent: mode === "build" && !!winner && !!model[m.num] && winner !== model[m.num],
    };
  };

  // build-mode scoring
  let chalk = 0;
  let upset = 0;
  let diverge = 0;
  for (const m of KO) {
    const w = picks[m.num];
    if (!w || !(ROUNDS as readonly string[]).includes(m.round)) continue;
    const h = partFromPicks(m, "home", picks);
    const a = partFromPicks(m, "away", picks);
    if (h && a && TEAMS[h] && TEAMS[a]) {
      const fav = effectiveRating(h) >= effectiveRating(a) ? h : a;
      if (w === fav) chalk++;
      else upset++;
    }
    if (model[m.num] && w !== model[m.num]) diverge++;
  }
  const made = ROUNDS.reduce(
    (n, r) => n + (byRound[r]?.filter((m) => picks[m.num]).length ?? 0),
    0,
  );
  const champion =
    mode === "live" ? live[FINAL_NUM]?.winner : mode === "model" ? model[FINAL_NUM] : picks[FINAL_NUM];

  return (
    <div className="rise max-w-3xl mx-auto">
      {/* mode switcher */}
      <div className="glass rounded-full p-1 flex gap-0.5 max-w-sm mx-auto mb-4">
        {(
          [
            ["build", "Build yours"],
            ["model", "Model's"],
            ["live", "Live"],
          ] as [Mode, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`flex-1 display text-xs rounded-full py-1.5 transition-colors ${
              mode === k ? "text-ink bg-[color-mix(in_srgb,var(--accent-a)_30%,var(--panel))]" : "text-faint hover:text-mute"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* summary */}
      <div className="card p-5 mb-6 sticky top-1 z-20">
        {mode === "build" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                {champion ? (
                  <ChampLine team={champion} sub={`model ${pct(data.teams[champion]?.title ?? 0, 1)} to win it`} />
                ) : (
                  <div className="display text-base text-mute">
                    Pick your champion — tap a team to advance them.
                  </div>
                )}
                <div className="text-xs text-faint mt-1 tnum">
                  {made}/{TOTAL_PICKS} picks · {chalk} favourite · {upset} upset
                  {upset === 1 ? "" : "s"} · {diverge} differ from model
                </div>
              </div>
              <div className="flex gap-1.5">
                {made > 0 && (
                  <button onClick={share} className="display text-xs text-ink rounded-full glass px-3 py-1.5">
                    {copied ? "✓ Copied" : "⤴ Share"}
                  </button>
                )}
                {made > 0 && (
                  <button onClick={() => setPicks({})} className="display text-xs text-faint hover:text-ink transition-colors rounded-full glass px-3 py-1.5">
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-faint mt-2">
              Seeded with the model&apos;s projected qualifiers — change any pick and the bracket re-flows.
              Diverging picks are marked.
            </p>
          </>
        )}
        {mode === "model" && (
          <>
            {champion && <ChampLine team={champion} sub={`model ${pct(data.teams[champion]?.title ?? 0, 1)} to win it`} />}
            <p className="text-[11px] text-faint mt-2">
              The model&apos;s bracket — the higher-rated team advances in every tie. Switch to{" "}
              <b className="text-mute">Build yours</b> to make your own picks against it.
            </p>
          </>
        )}
        {mode === "live" && (
          <p className="text-sm text-mute">
            {hasLive ? (
              <>The <b className="text-ink">actual bracket</b> so far — real teams and results as they&apos;re played.</>
            ) : (
              <>No knockout games have been played yet. The real bracket will fill in here once the Round of 32 begins.</>
            )}
          </p>
        )}
      </div>

      {/* rounds */}
      <div className="space-y-7">
        {ROUNDS.map((r) => (
          <section key={r}>
            <div className="eyebrow text-[11px] text-mute mb-2">{ROUND_LABEL[r]}</div>
            <div className={`grid grid-cols-1 gap-2 ${r === "R32" || r === "R16" ? "sm:grid-cols-2" : ""}`}>
              {byRound[r]?.map((m) => {
                const v = view(m);
                return (
                  <MatchCard
                    key={m.num}
                    m={m}
                    v={v}
                    onPick={(team) => pick(m.num, team)}
                    reachKey={NEXT_KEY[r]}
                    teams={data.teams}
                    showModel={mode !== "live"}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ChampLine({ team, sub }: { team: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-2xl">🏆</span>
      <span className="text-xl">{meta(team)?.flag}</span>
      <span className="display text-lg" style={{ color: accentColor(team) }}>{team}</span>
      <span className="text-xs text-faint">· {sub}</span>
    </div>
  );
}

type View = {
  home: string | null;
  away: string | null;
  winner: string | null;
  score: string | null;
  interactive: boolean;
  divergent: boolean;
};

function MatchCard({
  m,
  v,
  onPick,
  reachKey,
  teams,
  showModel,
}: {
  m: KMatch;
  v: View;
  onPick: (team: string) => void;
  reachKey: keyof ReachByRound;
  teams: SimResponse["teams"];
  showModel: boolean;
}) {
  return (
    <div className="card p-2.5">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="tnum text-[10px] font-bold text-mute">M{m.num}</span>
        <span className="text-[10px] text-faint truncate">{m.venue}</span>
        {v.score && <span className="ml-auto tnum text-[10px] text-ink font-semibold shrink-0">{v.score}</span>}
      </div>
      <div className="space-y-1">
        <Chip
          name={v.home}
          fallback={slotLabel(m.home)}
          picked={!!v.winner && v.winner === v.home}
          dim={!!v.winner && v.winner !== v.home}
          interactive={v.interactive}
          divergent={v.divergent && v.winner === v.home}
          onPick={onPick}
          model={showModel && v.home && teams[v.home] ? teams[v.home].reachByRound[reachKey] : undefined}
        />
        <Chip
          name={v.away}
          fallback={slotLabel(m.away)}
          picked={!!v.winner && v.winner === v.away}
          dim={!!v.winner && v.winner !== v.away}
          interactive={v.interactive}
          divergent={v.divergent && v.winner === v.away}
          onPick={onPick}
          model={showModel && v.away && teams[v.away] ? teams[v.away].reachByRound[reachKey] : undefined}
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
  interactive,
  divergent,
  onPick,
  model,
}: {
  name: string | null;
  fallback: string;
  picked: boolean;
  dim: boolean;
  interactive: boolean;
  divergent: boolean;
  onPick: (team: string) => void;
  model?: number;
}) {
  const real = !!name && !!TEAMS[name];
  const accent = real ? accentColor(name!) : "var(--line)";
  const clickable = interactive && real;
  return (
    <button
      disabled={!clickable}
      onClick={() => clickable && onPick(name!)}
      className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all ${
        clickable ? "cursor-pointer" : "cursor-default"
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
      {divergent && (
        <span className="text-[9px] font-bold shrink-0" style={{ color: "#FFD166" }} title="differs from the model">
          ≠
        </span>
      )}
      {picked && model != null && (
        <span className="tnum text-[10px] text-faint shrink-0" title="model's chance for this team">
          {pct(model, model < 0.1 ? 1 : 0)}
        </span>
      )}
      {clickable && !dim && !picked && (
        <span className="text-faint text-[10px] shrink-0 opacity-60">pick</span>
      )}
    </button>
  );
}
