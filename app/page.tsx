"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ViewSwitcher, { type ViewKey } from "@/components/ViewSwitcher";
import TeamSelect from "@/components/TeamSelect";
import ResultHero from "@/components/ResultHero";
import RoundBreakdown from "@/components/RoundBreakdown";
import TeamOddsCards from "@/components/TeamOddsCards";
import ScenarioPanel, { type Choice, fxKey } from "@/components/ScenarioPanel";
import StandingsView from "@/components/StandingsView";
import AboutView from "@/components/AboutView";
import { accentColor, TEAMS } from "@/lib/teams";
import { simulate } from "@/lib/api";
import type { ForcedResult, SimResponse } from "@/lib/types";

export default function Home() {
  // Start from defaults so SSR and the first client render match; apply any URL
  // params after mount (below) to avoid a hydration mismatch.
  const [view, setView] = useState<ViewKey>("simulate");
  const [teamA, setTeamA] = useState("Canada");
  const [teamB, setTeamB] = useState("Portugal");
  const [urlReady, setUrlReady] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [data, setData] = useState<SimResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const accentA = accentColor(teamA);
  const accentB = accentColor(teamB);

  // Build the forced-results scenario from the user's choices.
  const forced: ForcedResult[] = useMemo(() => {
    const ups = new Map((data?.upcoming ?? []).map((f) => [fxKey(f), f]));
    const out: ForcedResult[] = [];
    for (const [key, c] of Object.entries(choices)) {
      if (!c) continue;
      const f = ups.get(key);
      if (!f) continue;
      out.push({
        home: f.home,
        away: f.away,
        winner: c === "draw" ? "draw" : c === "home" ? f.home : f.away,
      });
    }
    return out;
  }, [choices, data?.upcoming]);

  const forcedKey = JSON.stringify(forced);

  // Apply URL params once, after mount (avoids SSR/client hydration mismatch).
  // Initializing from window/URL is only possible client-side, so the one-time
  // setState here is intentional.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = new URLSearchParams(window.location.search);
    const a = p.get("a");
    const b = p.get("b");
    const v = p.get("view");
    if (a && TEAMS[a]) setTeamA(a);
    if (b && TEAMS[b] && b !== a) setTeamB(b);
    if (v === "standings" || v === "about" || v === "simulate") setView(v);
    setUrlReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Keep the URL in sync so a given matchup/view is shareable.
  useEffect(() => {
    if (!urlReady) return;
    const p = new URLSearchParams();
    p.set("a", teamA);
    p.set("b", teamB);
    if (view !== "simulate") p.set("view", view);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [teamA, teamB, view, urlReady]);

  // Fetch whenever teams or scenario change (debounced; stale-while-revalidate).
  useEffect(() => {
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      simulate(teamA, teamB, forced.length ? { forced } : null, ac.signal)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          setError(e.message ?? "Something went wrong");
          setLoading(false);
        });
    }, 220);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamA, teamB, forcedKey]);

  const changeTeam = (which: "a" | "b", v: string) => {
    if (which === "a") {
      if (v === teamB) setTeamB(teamA);
      setTeamA(v);
    } else {
      if (v === teamA) setTeamA(teamB);
      setTeamB(v);
    }
    setChoices({}); // scenario fixtures change with the teams; start clean
  };

  const swap = () => {
    setTeamA(teamB);
    setTeamB(teamA);
    setChoices({});
  };

  const setChoice = useCallback((key: string, c: Choice) => {
    setChoices((prev) => ({ ...prev, [key]: c }));
  }, []);

  const relevantFixtures = (data?.upcoming ?? []).filter((f) =>
    [f.home, f.away].some((t) => t === teamA || t === teamB),
  );
  const dirty = forced.length > 0;

  return (
    <div
      style={
        { "--accent-a": accentA, "--accent-b": accentB } as React.CSSProperties
      }
      className="min-h-full"
    >
      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-20 pt-8 sm:pt-12">
        <header className="text-center mb-8">
          <div className="eyebrow text-[11px] text-mute">FIFA World Cup 2026 · Knockout Explorer</div>
          <h1
            className="display mt-2 leading-[0.95] px-2 text-balance"
            style={{ fontSize: "clamp(28px, 7vw, 64px)" }}
          >
            Road to the Final
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-mute">
            Pick any two of the 48 teams and see the live, simulated odds they collide on the
            way to New York — and exactly where it would happen.
          </p>
        </header>

        <div className="mb-8">
          <ViewSwitcher view={view} onChange={setView} />
        </div>

        {error && (
          <div className="card p-4 mb-6 text-sm text-red-300 border-red-500/40">
            Couldn&apos;t reach the simulation engine: {error}
          </div>
        )}

        {view === "simulate" && (
          <div className="space-y-5">
            {/* pickers */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
              <TeamSelect
                value={teamA}
                onChange={(v) => changeTeam("a", v)}
                accent={accentA}
                exclude={teamB}
              />
              <button
                onClick={swap}
                aria-label="Swap teams"
                className="mx-auto display text-faint hover:text-ink transition-colors rounded-full border border-line h-9 w-9 grid place-items-center"
              >
                ⇄
              </button>
              <TeamSelect
                value={teamB}
                onChange={(v) => changeTeam("b", v)}
                accent={accentB}
                exclude={teamA}
              />
            </div>

            {data?.pair ? (
              <>
                <ResultHero
                  pair={data.pair}
                  accentA={accentA}
                  accentB={accentB}
                  loading={loading}
                />
                <div className="grid gap-5 lg:grid-cols-2">
                  <RoundBreakdown pair={data.pair} accentA={accentA} accentB={accentB} />
                  <ScenarioPanel
                    fixtures={relevantFixtures}
                    choices={choices}
                    onChange={setChoice}
                    onReset={() => setChoices({})}
                    dirty={dirty}
                  />
                </div>
                {data.teams[teamA] && data.teams[teamB] && (
                  <TeamOddsCards
                    aName={teamA}
                    bName={teamB}
                    aStats={data.teams[teamA]}
                    bStats={data.teams[teamB]}
                    accentA={accentA}
                    accentB={accentB}
                  />
                )}
              </>
            ) : (
              <LoadingHero />
            )}

            <MetaLine data={data} loading={loading} />
          </div>
        )}

        {view === "standings" && (data ? <StandingsView data={data} /> : <LoadingHero />)}
        {view === "about" && <AboutView data={data} />}
      </main>
    </div>
  );
}

function LoadingHero() {
  return (
    <div className="card p-10 grid place-items-center min-h-[220px]">
      <div className="text-mute display text-sm animate-pulse">Simulating the tournament…</div>
    </div>
  );
}

function MetaLine({ data, loading }: { data: SimResponse | null; loading: boolean }) {
  if (!data) return null;
  return (
    <p className="text-center text-xs text-faint pt-2">
      {data.meta.nSims.toLocaleString()} simulations ·{" "}
      {data.meta.source === "live" ? "live data" : "snapshot data"}
      {data.meta.asOf ? ` as of ${data.meta.asOf}` : ""}
      {loading ? " · updating…" : ""}
    </p>
  );
}
