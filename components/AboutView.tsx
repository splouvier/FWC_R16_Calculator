"use client";

import type { SimResponse } from "@/lib/types";

export default function AboutView({ data }: { data: SimResponse | null }) {
  const nSims = (data?.meta.nSims ?? 24000).toLocaleString();
  const cal = data?.calibration;
  return (
    <div className="rise max-w-3xl mx-auto space-y-10">
      <header>
        <div className="eyebrow text-[11px] text-mute">How it works</div>
        <h2 className="display text-2xl sm:text-3xl mt-1">
          We play the rest of the tournament {nSims} times.
        </h2>
        <p className="text-sm text-mute mt-2 leading-relaxed">
          Every number on this site comes from a <b className="text-ink">Monte Carlo simulation</b>:
          we replay all the remaining games — group stage through the Final — tens of thousands of
          times, each time letting chance decide the goals. A team&apos;s odds are simply{" "}
          <i>how often</i> that thing happened across every simulated tournament.
        </p>
      </header>

      {cal && cal.n > 0 && (
        <section className="card p-5">
          <div className="eyebrow text-[11px] text-mute mb-3">
            Track record · {cal.n} games played so far
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Metric label="Called correctly" value={pctText(cal.accuracy)} />
            <Metric label="Favourites won" value={pctText(cal.favWinRate)} />
            <Metric label="Brier score" value={cal.brier?.toFixed(2) ?? "—"} hint="lower is better" />
          </div>
          {cal.buckets && cal.buckets.length > 0 && <Reliability buckets={cal.buckets} />}
          <p className="text-xs text-faint mt-3">
            When the model said an outcome was likely, did it happen that often? Dots near the
            dashed line mean the probabilities are well-calibrated.
          </p>
        </section>
      )}

      <Step n={1} title="Stronger teams score more — but not always">
        <p>
          Each team has a strength rating. The bigger the gap between two teams, the more goals the
          favourite is expected to score. We deliberately keep a floor so even big underdogs always
          carry a puncher&apos;s chance — World Cups are full of shocks.
        </p>
        <XgCurve />
        <Caption>
          Expected goals vs. the rating gap. At an even matchup (gap 0) each side expects about 1.3
          goals. Co-hosts USA, Canada and Mexico get a small boost for playing at home.
        </Caption>
      </Step>

      <Step n={2} title="Goals are random, not guaranteed">
        <p>
          &ldquo;Expected 1.3 goals&rdquo; doesn&apos;t mean exactly one or two — it&apos;s an
          average. Actual goals are drawn from a <b className="text-ink">Poisson distribution</b>, the
          standard model for football scoring. So an evenly-matched game looks like this:
        </p>
        <PoissonBars lambda={1.3} />
        <Caption>Chance of a team scoring k goals when its expected total is 1.3.</Caption>
      </Step>

      <Step n={3} title="Group tables decide who advances">
        <p>
          After simulating each remaining group game, we sort every group by{" "}
          <b className="text-ink">points → goal difference → goals scored</b> (then a coin toss for
          exact ties — standing in for FIFA&apos;s head-to-head and drawing-of-lots rules). The top
          two of each group go through, plus the eight best third-placed teams.
        </p>
      </Step>

      <Step n={4} title="Then it&apos;s a straight knockout to the Final">
        <p>
          The 32 survivors flow through a fixed bracket. Each tie is the same goal model; if it
          finishes level, a rating-weighted coin flip stands in for extra time and penalties.
        </p>
        <BracketFlow />
        <Caption>48 teams → 32 in the knockouts → one champion, across five rounds.</Caption>
      </Step>

      <Step n={5} title="The eight best third-placed teams">
        <p>
          With 12 groups, the four weakest runners-up miss out and the bracket slots for the
          qualifying third-placed teams depend on <i>which</i> groups they came from. We assign them
          respecting FIFA&apos;s group-pairing constraints — a faithful approximation of the official
          lookup table.
        </p>
      </Step>

      <section className="space-y-3">
        <h3 className="display text-xl text-ink">Reading the numbers</h3>
        <ul className="text-sm text-mute space-y-2 leading-relaxed">
          <li>
            <b className="text-ink">± margins</b> — with {nSims} runs, a headline figure is accurate
            to roughly a few tenths of a percent. We show that 95% margin next to the dream number.
          </li>
          <li>
            <b className="text-ink">▲▼ momentum</b> — the green/red chips show how each team&apos;s
            odds moved since yesterday&apos;s snapshot, captured daily.
          </li>
          <li>
            <b className="text-ink">Live data</b> — standings come from the public-domain{" "}
            <a className="text-ink underline decoration-dotted" href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">openfootball</a>{" "}
            dataset and refresh through the group stage. Current source:{" "}
            <b className="text-ink">{data?.meta.source ?? "—"}</b>
            {data?.meta.asOf ? `, as of ${data.meta.asOf}` : ""}.
          </li>
        </ul>
      </section>

      <section className="text-xs text-faint leading-relaxed border-t border-line pt-5">
        <b className="text-mute">Caveats.</b> These are illustrative estimates, not predictions or
        betting advice. Strength ratings are subjective; injuries, form and tactics aren&apos;t
        modelled; goals are treated as independent. Not affiliated with FIFA.
      </section>
    </div>
  );
}

/* ---------- layout helpers ---------- */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-4">
      <div className="display grid place-items-center w-9 h-9 rounded-full text-ink shrink-0"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-a) 40%, var(--panel)), color-mix(in srgb, var(--accent-b) 40%, var(--panel-2)))" }}>
        {n}
      </div>
      <div className="min-w-0">
        <h3 className="display text-lg text-ink mb-2">{title}</h3>
        <div className="text-sm text-mute leading-relaxed space-y-3">{children}</div>
      </div>
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-faint mt-2">{children}</p>;
}

function pctText(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-center">
      <div className="display text-2xl text-ink tnum">{value}</div>
      <div className="text-[11px] text-mute mt-0.5">{label}</div>
      {hint && <div className="text-[9px] text-faint">{hint}</div>}
    </div>
  );
}

/** Reliability diagram: dots at (predicted, actual); the dashed diagonal is perfect. */
function Reliability({ buckets }: { buckets: { predicted: number; actual: number; n: number }[] }) {
  const S = 150;
  const pad = 14;
  const px = (v: number) => pad + v * (S - 2 * pad);
  const py = (v: number) => S - pad - v * (S - 2 * pad);
  const maxN = Math.max(...buckets.map((b) => b.n));
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[200px] mx-auto block" role="img" aria-label="Calibration reliability diagram">
      <rect x={pad} y={pad} width={S - 2 * pad} height={S - 2 * pad} fill="none" stroke="var(--line)" />
      <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="var(--faint)" strokeDasharray="3 3" />
      {buckets.map((b, i) => (
        <circle
          key={i}
          cx={px(b.predicted)}
          cy={py(b.actual)}
          r={3 + 4 * (b.n / maxN)}
          fill="var(--accent-a)"
          fillOpacity={0.8}
        />
      ))}
      <text x={px(0.5)} y={S - 1} textAnchor="middle" fontSize="8" fill="var(--faint)">predicted →</text>
      <text x={3} y={py(0.5)} fontSize="8" fill="var(--faint)" transform={`rotate(-90 3 ${py(0.5)})`} textAnchor="middle">actual →</text>
    </svg>
  );
}

/* ---------- graphics ---------- */
function XgCurve() {
  const W = 520, H = 170, pad = 28;
  const xg = (d: number) => Math.max(0.18, 1.3 * Math.exp(0.92 * d));
  const xs: number[] = [];
  for (let d = -0.7; d <= 0.7001; d += 0.05) xs.push(d);
  const maxY = xg(0.7);
  const px = (d: number) => pad + ((d + 0.7) / 1.4) * (W - 2 * pad);
  const py = (y: number) => H - pad - (y / maxY) * (H - 2 * pad);
  const path = xs.map((d, i) => `${i ? "L" : "M"}${px(d).toFixed(1)},${py(xg(d)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full card p-2" role="img" aria-label="Expected goals curve">
      {/* axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
      <line x1={px(0)} y1={pad} x2={px(0)} y2={H - pad} stroke="var(--line)" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="var(--accent-a)" strokeWidth={2.5} />
      <circle cx={px(0)} cy={py(xg(0))} r={4} fill="var(--accent-b)" />
      <text x={px(0)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--faint)">even</text>
      <text x={px(-0.65)} y={H - 8} fontSize="10" fill="var(--faint)">underdog</text>
      <text x={px(0.5)} y={H - 8} fontSize="10" fill="var(--faint)">favourite</text>
      <text x={px(0) + 8} y={py(xg(0)) - 6} fontSize="10" fill="var(--mute)">≈1.3 goals</text>
    </svg>
  );
}

function PoissonBars({ lambda }: { lambda: number }) {
  const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
  const p = (k: number) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fact(k);
  const ks = [0, 1, 2, 3, 4, 5];
  const max = Math.max(...ks.map(p));
  return (
    <div className="card p-4 flex items-end justify-around gap-2 h-40">
      {ks.map((k) => {
        const prob = p(k);
        return (
          <div key={k} className="flex flex-col items-center gap-1 flex-1">
            <span className="tnum text-[10px] text-mute">{Math.round(prob * 100)}%</span>
            <div className="w-full rounded-t" style={{ height: `${(prob / max) * 90}%`, background: "linear-gradient(180deg, var(--accent-a), var(--accent-b))" }} />
            <span className="tnum text-[11px] text-faint">{k}</span>
          </div>
        );
      })}
    </div>
  );
}

function BracketFlow() {
  const rounds = [
    { label: "Groups", n: 48 },
    { label: "R32", n: 32 },
    { label: "R16", n: 16 },
    { label: "QF", n: 8 },
    { label: "SF", n: 4 },
    { label: "Final", n: 2 },
    { label: "🏆", n: 1 },
  ];
  return (
    <div className="card p-3 sm:p-4 flex items-stretch gap-0.5 sm:gap-1">
      {rounds.map((r, i) => (
        <div key={r.label} className="flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0 last:flex-none">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="display text-sm sm:text-base text-ink tnum">{r.n}</div>
            <div className="eyebrow text-[8px] sm:text-[9px] leading-tight">{r.label}</div>
          </div>
          {i < rounds.length - 1 && <span className="text-faint shrink-0">→</span>}
        </div>
      ))}
    </div>
  );
}
