# Road to the Final — FIFA World Cup 2026 Knockout Explorer

Pick any two of the 48 teams and see the live, simulated odds they meet on the road to
the Final — and exactly which round and venue it would happen in. Powered by a Monte Carlo
engine that plays out the whole tournament tens of thousands of times.

**Live:** https://fwc-r16-calculator.vercel.app

This started as a single hardcoded page answering one question ("will Canada meet Portugal
in the July 7 Vancouver Round of 16?"). It's now a full app: any matchup, the entire
bracket from the Round of 32 to the Final, a real Python simulation backend, live standings,
and a bold, responsive, team-themed UI.

## How it works

A single vectorized Monte Carlo run plays the rest of the tournament `N` times — the
remaining group games, third-place qualification and bracket slotting, then every knockout
round — and aggregates **every** per-team and pairwise answer at once. Selecting a different
pair or venue just reads from the cached run, so it feels instant. Forcing a "what-if"
result re-runs the simulation under that constraint.

- **Engine** — `api/_engine.py` (NumPy). Poisson goals from team-strength rating gaps; real
  group tiebreakers; rating-weighted coin flips for level knockout ties; best-8-of-12
  third-place slotting via constrained bipartite matching.
- **API** — `api/simulate.py`, a Vercel Python serverless function. `GET` for the default
  (cacheable), `POST` when a what-if scenario is set.
- **Frontend** — Next.js (App Router) + TypeScript + Tailwind v4. One page, three views
  (Simulate · Standings · Method), dynamic theming from the two selected teams' colours.

## Data

- **Live standings & results** — the public-domain
  [openfootball](https://github.com/openfootball/worldcup.json) 2026 dataset (no API key),
  fetched at runtime with a committed snapshot (`data/wc2026_snapshot.json`) as a fallback.
- **Bracket topology** — `data/bracket.json`, parsed from the official schedule by
  `scripts/build_bracket.py` (which group slots feed each knockout match, plus venues/dates).
- **Team ratings & colours** — `data/teams.json` (Elo-style strength + national kit colours).

## Local development

The Python function isn't served by `next dev`, so run the standalone dev API alongside it;
`next.config.ts` proxies `/api/*` to it in development.

```bash
# terminal 1 — simulation API on :8000
python3 scripts/dev_api.py

# terminal 2 — Next.js dev server on :3000
npm install
npm run dev
```

Quick engine self-check (no servers needed):

```bash
python3 api/_engine.py
```

## Deploy

Push to `main`; Vercel builds the Next.js app and the Python function (`vercel.json` pins the
runtime and bundles `data/`). Requires the project's **Framework Preset = Next.js**.

---

The original single-file version is kept in `legacy/` for posterity. Figures are illustrative
modelled estimates, not predictions. Not affiliated with FIFA.
