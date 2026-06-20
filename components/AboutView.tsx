"use client";

import type { SimResponse } from "@/lib/types";

export default function AboutView({ data }: { data: SimResponse | null }) {
  return (
    <div className="rise max-w-2xl space-y-6 text-sm leading-relaxed text-mute">
      <section>
        <h3 className="display text-xl text-ink mb-2">How this works</h3>
        <p>
          Every time you change a team, venue, or what-if, a Monte Carlo engine plays out the
          rest of the tournament{" "}
          <b className="text-ink">{(data?.meta.nSims ?? 24000).toLocaleString()} times</b> —
          the remaining group games, third-place qualification, then the full bracket from the
          Round of 32 to the Final. The percentages are how often each thing happened across
          those simulated tournaments.
        </p>
      </section>
      <section>
        <h3 className="display text-xl text-ink mb-2">The model</h3>
        <p>
          Each match&apos;s goals are drawn from a Poisson distribution whose rate depends on the
          gap in team strength ratings. Group tables use real tiebreakers (points, then goal
          difference, then goals for). Knockout ties that finish level are decided by a
          rating-weighted coin flip standing in for extra time and penalties. The eight
          best third-placed teams are slotted into the bracket respecting FIFA&apos;s
          group-pairing constraints.
        </p>
      </section>
      <section>
        <h3 className="display text-xl text-ink mb-2">The data</h3>
        <p>
          Standings and results are pulled live from the public-domain{" "}
          <a
            className="text-ink underline decoration-dotted"
            href="https://github.com/openfootball/worldcup.json"
            target="_blank"
            rel="noreferrer"
          >
            openfootball
          </a>{" "}
          dataset and update through the group stage. Current source:{" "}
          <b className="text-ink">{data?.meta.source ?? "—"}</b>
          {data?.meta.asOf ? `, as of ${data.meta.asOf}` : ""}. Team strength ratings are a
          fixed Elo-style table. The full 2026 bracket — which group slots feed each knockout
          match, and where every match is played — is encoded from the official schedule.
        </p>
      </section>
      <section>
        <h3 className="display text-xl text-ink mb-2">Caveats</h3>
        <p>
          These are illustrative estimates, not predictions or betting advice. Ratings are
          subjective, injuries and form aren&apos;t modelled, and the third-place slotting is a
          faithful approximation of FIFA&apos;s official table. Not affiliated with FIFA.
        </p>
      </section>
    </div>
  );
}
