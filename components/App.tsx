"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ViewSwitcher, { type ViewKey } from "@/components/ViewSwitcher";
import TeamSelect from "@/components/TeamSelect";
import ResultHero from "@/components/ResultHero";
import RoundBreakdown from "@/components/RoundBreakdown";
import TeamOddsCards from "@/components/TeamOddsCards";
import ScenarioPanel, { type Choice, fxKey } from "@/components/ScenarioPanel";
import SensitivityPanel from "@/components/SensitivityPanel";
import StandingsView from "@/components/StandingsView";
import BracketView from "@/components/BracketView";
import LeadersView from "@/components/LeadersView";
import ScheduleView from "@/components/ScheduleView";
import AboutView from "@/components/AboutView";
import { accentColor, TEAMS } from "@/lib/teams";
import { simulate } from "@/lib/api";
import type { ForcedResult, SimResponse } from "@/lib/types";

export default function App({ initialData }: { initialData?: SimResponse }) {
  // Start from defaults so SSR and the first client render match; apply any URL
  // params after mount (below) to avoid a hydration mismatch.
  const [view, setView] = useState<ViewKey>("simulate");
  const [teamA, setTeamA] = useState("Canada");
  const [teamB, setTeamB] = useState("Portugal");
  const [urlReady, setUrlReady] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  // Seed with the precomputed default so the first paint isn't blank; the mount
  // fetch refreshes it (and swaps to a different pair if the URL asks for one).
  const [data, setData] = useState<SimResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
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
    const views: ViewKey[] = [
      "simulate",
      "bracket",
      "leaders",
      "schedule",
      "standings",
      "about",
    ];
    if (a && TEAMS[a]) setTeamA(a);
    if (b && TEAMS[b] && b !== a) setTeamB(b);
    if (v && (views as string[]).includes(v)) setView(v as ViewKey);
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

  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Jump to a matchup from a leaderboard, then show it on the Simulate tab.
  const pickPair = (a: string, b: string) => {
    if (a === b) return;
    setTeamA(a);
    setTeamB(b);
    setChoices({});
    setView("simulate");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20 pt-8 sm:pt-12">
        <header className="text-center mb-8">
          <div className="eyebrow text-[11px]">FIFA World Cup 2026 · Knockout Explorer</div>
          <h1
            className="display mt-2 leading-[0.95] px-2 text-balance"
            style={{ fontSize: "clamp(30px, 7.5vw, 66px)" }}
          >
            <span
              style={{
                backgroundImage:
                  "linear-gradient(100deg, #ffffff 18%, color-mix(in srgb, var(--accent-a) 55%, #ffffff) 55%, color-mix(in srgb, var(--accent-b) 60%, #ffffff) 90%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              Road to the Final
            </span>
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

        {/* Team pickers (shown for the matchup-driven views) */}
        {(view === "simulate" || view === "bracket") && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center max-w-4xl mx-auto mb-5">
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
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {view === "simulate" && (
              <div className="space-y-5 max-w-4xl mx-auto">
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
                        trends={data.trends}
                      />
                    )}
                    <SensitivityPanel teamA={teamA} teamB={teamB} />
                  </>
                ) : (
                  <LoadingHero />
                )}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={share}
                    className="glass rounded-full px-4 py-2 text-xs display text-mute hover:text-ink transition-colors"
                  >
                    {copied ? "✓ Link copied" : "⤴ Share this matchup"}
                  </button>
                </div>
                <MetaLine data={data} loading={loading} />
              </div>
            )}

            {view === "bracket" && (
              <div className="max-w-3xl mx-auto">
                {data ? (
                  <BracketView
                    data={data}
                    teamA={teamA}
                    teamB={teamB}
                    accentA={accentA}
                    accentB={accentB}
                  />
                ) : (
                  <LoadingHero />
                )}
              </div>
            )}

            {view === "leaders" &&
              (data ? <LeadersView data={data} onPickPair={pickPair} /> : <LoadingHero />)}

            {view === "schedule" && <ScheduleView teamA={teamA} teamB={teamB} />}

            {view === "standings" && (data ? <StandingsView data={data} /> : <LoadingHero />)}
            {view === "about" && <AboutView data={data} />}
          </motion.div>
        </AnimatePresence>
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
