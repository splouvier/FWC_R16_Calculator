"use client";

import { meta } from "@/lib/teams";
import { pct } from "@/lib/api";
import { planPaths, ROUND_INDEX } from "@/lib/bracket";
import { ROUND_LABEL, type SimResponse } from "@/lib/types";

const REACH_KEY = ["R32", "R16", "QF", "SF", "F"] as const;

export default function BracketView({
  data,
  teamA,
  teamB,
  accentA,
  accentB,
}: {
  data: SimResponse;
  teamA: string;
  teamB: string;
  accentA: string;
  accentB: string;
}) {
  const mA = meta(teamA);
  const mB = meta(teamB);
  const statsA = data.teams[teamA];
  const statsB = data.teams[teamB];
  if (!mA || !mB) return null;

  // Target the round where they're *most likely* to meet, then show the paths
  // (group-finish positions) that actually produce that meeting.
  const byRound = data.pair?.byRound ?? {};
  const targetRound =
    Object.entries(byRound).sort((a, b) => b[1].prob - a[1].prob)[0]?.[0] ?? null;
  const plan = planPaths(mA.group, statsA, mB.group, statsB, targetRound);
  const pathA = { entry: plan.entryA, matches: plan.pathA };
  const pathB = { entry: plan.entryB, matches: plan.pathB };
  const conv = plan.conv;
  const convIdx = conv ? ROUND_INDEX[conv.round] : 4;

  const meetThisRound = conv ? data.pair?.byRound[conv.round]?.prob ?? 0 : 0;

  return (
    <div className="rise space-y-5">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-sm text-mute">
          Each side&apos;s <b className="text-ink">most likely run</b> through the bracket —
          assuming{" "}
          <span style={{ color: accentA }}>
            {teamA} {pathA.entry.kind === "group_1st" ? "win" : "place 2nd in"} Group {mA.group} (
            {pct(pathA.entry.conf)})
          </span>{" "}
          and{" "}
          <span style={{ color: accentB }}>
            {teamB} {pathB.entry.kind === "group_1st" ? "win" : "place 2nd in"} Group {mB.group} (
            {pct(pathB.entry.conf)})
          </span>
          . They first cross paths in the{" "}
          <b className="text-ink">{conv ? ROUND_LABEL[conv.round] : "Final"}</b>.
        </p>
      </div>

      <div className="space-y-3">
        {REACH_KEY.map((rk, i) => {
          const label = ROUND_LABEL[rk];
          const mAi = pathA.matches[i];
          const mBi = pathB.matches[i];

          if (i < convIdx) {
            // split: two separate lanes
            return (
              <Row key={rk} label={label}>
                <Lane
                  team={teamA}
                  flag={mA.flag}
                  venue={mAi?.venue}
                  reach={statsA?.reachByRound?.[rk] ?? 0}
                  accent={accentA}
                  align="right"
                />
                <div className="hidden sm:block w-px self-stretch bg-line mx-1" />
                <Lane
                  team={teamB}
                  flag={mB.flag}
                  venue={mBi?.venue}
                  reach={statsB?.reachByRound?.[rk] ?? 0}
                  accent={accentB}
                  align="left"
                />
              </Row>
            );
          }
          if (i === convIdx) {
            // convergence: the meeting
            return (
              <Row key={rk} label={label} highlight>
                <div
                  className="flex-1 rounded-xl p-4 text-center relative overflow-hidden"
                  style={{
                    background: `radial-gradient(120% 160% at 0% 50%, ${accentA}30, transparent 60%), radial-gradient(120% 160% at 100% 50%, ${accentB}30, transparent 60%), var(--panel)`,
                    border: `1px solid color-mix(in srgb, ${accentA} 50%, ${accentB})`,
                  }}
                >
                  <div className="eyebrow text-[10px] text-mute">★ They meet here</div>
                  <div className="display text-lg mt-1">
                    <span style={{ color: accentA }}>{mA.flag} {teamA}</span>
                    <span className="text-faint mx-2">vs</span>
                    <span style={{ color: accentB }}>{teamB} {mB.flag}</span>
                  </div>
                  <div className="text-xs text-mute mt-1">
                    {conv?.venue}
                    {conv?.date ? ` · ${fmtDate(conv.date)}` : ""} ·{" "}
                    <span className="text-ink font-semibold">{pct(meetThisRound, 1)}</span> chance
                  </div>
                </div>
              </Row>
            );
          }
          // shared onward path
          return (
            <Row key={rk} label={label}>
              <div className="flex-1 rounded-xl p-3 text-center border border-line bg-[color-mix(in_srgb,var(--panel)_60%,transparent)]">
                <span className="text-xs text-faint">Winner advances</span>
                {mAi?.venue && <span className="text-xs text-mute"> · {mAi.venue}</span>}
              </div>
            </Row>
          );
        })}
      </div>

      {data.pair && Object.keys(data.pair.byRound).length > 1 && (
        <p className="text-center text-xs text-faint max-w-xl mx-auto">
          They could also meet in other rounds if either finishes in a different group position —
          see the full round-by-round breakdown on the Simulate tab.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-16 sm:w-24 shrink-0 text-right display text-[11px] sm:text-xs ${
          highlight ? "text-ink" : "text-faint"
        }`}
      >
        {label}
      </div>
      <div className="flex-1 flex items-stretch gap-2 min-w-0">{children}</div>
    </div>
  );
}

function Lane({
  team,
  flag,
  venue,
  reach,
  accent,
  align,
}: {
  team: string;
  flag: string;
  venue?: string;
  reach: number;
  accent: string;
  align: "left" | "right";
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl p-3 border bg-[color-mix(in_srgb,var(--panel)_55%,transparent)]"
      style={{ borderColor: `${accent}44` }}
    >
      <div
        className={`flex items-center gap-2 min-w-0 ${align === "right" ? "sm:flex-row-reverse sm:text-right" : ""}`}
      >
        <span className="text-base shrink-0">{flag}</span>
        <span className="display text-sm truncate" style={{ color: accent }}>
          {team}
        </span>
        <span className="ml-auto tnum text-xs text-mute shrink-0">{pct(reach)}</span>
      </div>
      {venue && <div className="text-[11px] text-faint mt-1 truncate">{venue}</div>}
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
